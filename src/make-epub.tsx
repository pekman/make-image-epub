import * as zip from "@zip.js/zip.js";
import * as mime from "mime-types";
import type { Nodes } from "xast";
import { toXml } from "xast-util-to-xml";
import { x } from "xastscript";

import { isCaptionFile, type Caption } from "./captions.js";
import {
  iterDublinCoreMetadata,
  splitRoleAndValue,
  type EpubParameters,
} from "./epub-parameters.js";
import { FilenameMangler, removeCommonPathPrefix } from "./filenames.js";
import { makeTree, type Tree } from "./make-tree.js";

import containerXml from "./epub-static/container.xml?raw";
import styleCss from "./epub-static/style.css?raw";


const ZIP_OPTIONS = {
  level: 9,
  extendedTimestamp: false,
} as const satisfies zip.ZipWriterAddDataOptions;


export interface ImageSource {
  /** Image path. Must use "/" as directory separator, even on Windows. */
  filename: string;

  readImage(): Promise<ReadableStream<Uint8Array> | Uint8Array>;
  getTimestamp?(): Promise<Date | null | undefined>;
  readCaption?(): Promise<string | Caption | null | undefined>;
}


/** Return true if mimetype is supported. */
export const isMimetypeSupported = (mimetype: string) =>
  /^(?:image|video|audio)\//.test(mimetype);

/** Return true if mimetype is one of EPUB core media types.
 *
 * Core media types are defined in
 * https://www.w3.org/TR/epub-33/#sec-core-media-types
 */
const isCoreMediaType = (mimetype: string, path: string) =>
  /^(?:image\/(?:gif|jpeg|png|svg\+xml|webp)|audio\/mp(?:eg|4))(?:;|$)/.test(
    mimetype
  ) || (
    mimetype === "audio/ogg" && /\.opus$/i.test(path)
  );


class ImageInfo {
  /** image name shown to user */
  readonly displayedName: string;

  /** image path shown in navigation UI */
  readonly displayedPath: readonly string[];

  /** Mimetype if image, undefined if caption without image */
  readonly mimetype: string | undefined;

  isTextOnlyPage() {
    return this.mimetype === undefined;
  }

  constructor(
    srcPath: string,  // non-unique subpath, not the whole path
    /** image path in zip file relative to OEBPS/ directory */
    readonly destPath: string,
  ) {
    const parts = srcPath.split("/");
    this.displayedName = parts.at(-1)!.replace(filenameExtRe, "");
    if (parts[0] === "" || parts[0] === ".") {
      parts.shift();
    }
    this.displayedPath = parts;

    if (isCaptionFile(destPath)) {
      this.mimetype = undefined;
    }
    else {
      let mimetype = mime.lookup(destPath);
      if (!mimetype) {
        console.warn("Warning: Cannot determine file type for %o", destPath);
        mimetype = "application/octet-stream";
      }
      else if (!isMimetypeSupported(mimetype)) {
        console.warn(
          "Warning: %o is not a supported media file. It is %o.",
          destPath, mimetype);
      }
      else if (!isCoreMediaType(mimetype, destPath) &&
        // Don't warn about videos. There are no core media types for
        // videos, and it would be silly to complain about every video.
        !mimetype.startsWith("video/")
      ) {
        console.warn(
          "Warning: %o may be incompatible with some readers." +
          "Its media type, %o, is not an EPUB core media type.",
          destPath, mimetype);
      }
      this.mimetype = mimetype;
    }
  }
}


// <?xml …?> declaration as returned by unist-builder/u()
const XML_DECLARATION = {
  type: "instruction",
  name: "xml",
  value: 'version="1.0" encoding="UTF-8"',
} as const;

const makeXml = (tree: Nodes) => toXml(
  [XML_DECLARATION, tree],
  { closeEmptyElements: true },  // use <tag /> syntax
)
  .toWellFormed()
  .replace(
    // Allow only characters allowed in XML 1.0 spec
    // https://www.w3.org/TR/xml/#charsets
    // eslint-disable-next-line no-control-regex
    /[\x00-\x08\x0B\x0C\x0E-\x1F\uD800-\uDFFF\uFFFE\uFFFF]/gu,
    "\uFFFD",  // replacement character
  );


const filenameExtRe = /(?:\.[a-zA-Z0-9]+)?$/;

const imageFilenameToXhtmlFilename = (imgName: string) =>
  imgName.replace(filenameExtRe, ".xhtml");


const makeContentOpf = (
  images: readonly ImageInfo[],
  epubParameters: EpubParameters,
) => {
  // Globally unique document ID. Must be valid XML identifier, which
  // means it can't start with a number.
  const id = crypto.randomUUID().replace(/^\d/, "_$&");

  // Current time in format YYYY-MM-DDThh:mm:ssZ
  const now = new Date().toISOString()
    .replace(/\.\d+/, "");  // remove fractional part of seconds

  let idCounter = 1;

  function makeDublinCoreMetadataItem(
    key: Parameters<typeof splitRoleAndValue>[0],
    value: string,
  ) {
    const tag = `dc:${key}`;
    const [role, actualValue] = splitRoleAndValue(key, value);
    if (role != null) {
      const id = `id${idCounter}`;
      idCounter++;
      return x(null,  // fragment
        x(tag, { id }, actualValue),
        <meta
          refines={`#${id}`}
          property="role"
          scheme="marc:relators"
        >
          {role}
        </meta>,
      );
    }
    else {
      return x(tag, actualValue);
    }
  }

  // Note: This file and all files referred to are in the same
  // directory in the zip archive. No paths needed in URLs.
  return makeXml(
    <package
      xmlns="http://www.idpf.org/2007/opf"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      unique-identifier={id}
      version="3.0"
      xml:lang={epubParameters.language}
      prefix={
        // These are "Reserved prefixes". Declaring them here is not
        // strictly required, but it's recommended for compatibility.
        "dcterms: http://purl.org/dc/terms/ " +
        "marc: http://id.loc.gov/vocabulary/"
      }
    >
      <metadata>
        <dc:title>{epubParameters.title}</dc:title>
        <dc:language>{epubParameters.language}</dc:language>

        {/* <identifier> is required. It's meant for things like ISBN
            or DOI, but we don't really have anything useful to put
            there. Let's just use the same randomly generated id. */}
        <dc:identifier id={id}>{id}</dc:identifier>

        {/* <meta property="dcterms:modified"> is required and refers
            to the modification time of the EPUB document, not its
            content. */}
        <meta property="dcterms:modified">{now}</meta>

        <>{
          iterDublinCoreMetadata(epubParameters).map(([key, value]) =>
            makeDublinCoreMetadataItem(key, value)
          ).toArray()
        }</>
      </metadata>

      <manifest>
        <item
          id="nav"
          href="nav.xhtml"
          properties="nav"
          media-type="application/xhtml+xml"
        />
        <item
          id="style"
          href="style.css"
          media-type="text/css"
        />

        <>{
          images.entries()
            .flatMap(([i, img]) => [
              <item
                id={`page-${i + 1}`}
                href={imageFilenameToXhtmlFilename(img.destPath)}
                media-type="application/xhtml+xml"
              />
              ,
              ...(img.isTextOnlyPage()
                ? []
                : [
                  <item
                    id={`image-${i + 1}`}
                    href={img.destPath}
                    media-type={img.mimetype}
                  />
                ])
            ])
            .toArray()
        }</>
      </manifest>

      <spine>
        {images.keys().map((i) =>
          <itemref idref={`page-${i+1}`} />
        ).toArray()}
      </spine>
    </package>
  );
};


const makeNavigationDocument = (
  images: readonly ImageInfo[],
  epubParameters: EpubParameters,
) => {
  const makeNavTree = (subtrees: readonly Tree<{ href: string }>[]) =>
    <ol>
      {subtrees.map((subtree) =>
        <li>
          {"name" in subtree ? (
            <a href={imageFilenameToXhtmlFilename(subtree.href)}>
              {subtree.name}
            </a>
          ) : (
            <>
              <a href={imageFilenameToXhtmlFilename(subtree[0].href)}>
                {subtree[0].name}
              </a>
              {makeNavTree(subtree[1])}
            </>
          )}
        </li>
      )}
    </ol>;

  return makeXml(
    <html
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      lang={epubParameters.language}
    >
      <head>
        <title>{epubParameters.title}</title>
      </head>
      <body>
        <nav epub:type="toc">
          {makeNavTree(makeTree(images.map((img) => ({
            path: img.displayedPath,
            href: img.destPath,
          }))))}
        </nav>
      </body>
    </html>
  );
};


const makePageXhtml = (
  image: ImageInfo,
  caption: string | Caption | null | undefined,
  epubParameters: EpubParameters,
) => {
  // This .xhtml file goes to the same subdirectory as the image. Use
  // filename without path as src.
  const imgSrc = image.destPath.replace(/^.*\//s, "");

  const styleCssHref = "../".repeat(
    image.destPath.matchAll(/\//g).toArray().length
  ) + "style.css";

  return makeXml(
    <html
      xmlns="http://www.w3.org/1999/xhtml"
      lang={epubParameters.language}
    >
      <head>
        <title>{image.displayedName}</title>
        <link rel="stylesheet" href={styleCssHref} />
      </head>
      <body>
        {
          image.mimetype === undefined ? (
            null
          ) : image.mimetype.startsWith("video/") ? (
            <video controls="controls">
              <source src={imgSrc} type={image.mimetype} />
              Your reader doesn't support playing this video.
              <a href={imgSrc}>Open or download video</a>
              (may not work on all readers)
            </video>
          ) : image.mimetype.startsWith("audio/") ? (
            <audio controls="controls">
              <source src={imgSrc} type={image.mimetype} />
              Your reader doesn't support playing this audio file.
              <a href={imgSrc}>Open or download audio file</a>
              (may not work on all readers)
            </audio>
          ) : (
            <img src={imgSrc} />
          )
        }
        {caption != null
          ? (
            <div id="caption">
              {caption as string | Nodes | null | undefined}
            </div>
          )
          : null
        }
      </body>
    </html>
  );
};

export async function makeEpub(
  imageSources: readonly ImageSource[],
  epubParameters: EpubParameters,
  outputStream: WritableStream,
) {
  // Remove common directory prefix from filenames, convert them to
  // EPUB-compatible form, and wrap them in ImageInfo
  const filenameMangler = new FilenameMangler();
  const imageInfos = removeCommonPathPrefix(
    imageSources.map((imgSrc) => imgSrc.filename),
  ).map(
    (filename) => new ImageInfo(filename, filenameMangler.mangle(filename))
  );

  const zipWriter = new zip.ZipWriter(outputStream);

  const addFile = (filename: string, data: string) =>
    zipWriter.add(
      filename,
      new zip.TextReader(data),
      ZIP_OPTIONS,
    );

  // Write mimetype file. It must be stored uncompressed as the first
  // file in the archive with no extra header fields.
  await zipWriter.add(
    "mimetype",
    new zip.TextReader("application/epub+zip"),
    {
      compressionMethod: 0,
      extendedTimestamp: false,
    },
  );

  await addFile("META-INF/container.xml", containerXml);
  await addFile(
    "OEBPS/content.opf",
    makeContentOpf(imageInfos, epubParameters),
  );
  await addFile(
    "OEBPS/nav.xhtml",
    makeNavigationDocument(imageInfos, epubParameters),
  );
  await addFile("OEBPS/style.css", styleCss);

  for (let i=0; i < imageSources.length; i++) {
    const imageSource = imageSources[i]!;
    const imageInfo = imageInfos[i]!;

    // add page xhtml
    await addFile(
      `OEBPS/${imageFilenameToXhtmlFilename(imageInfo.destPath)}`,
      makePageXhtml(
        imageInfo,
        await imageSource.readCaption?.(),
        epubParameters,
      ),
    );

    if (!imageInfo.isTextOnlyPage()) {
      // add image
      let options: zip.ZipWriterAddDataOptions = ZIP_OPTIONS;
      const timestamp = await imageSource.getTimestamp?.();
      if (timestamp != null) {
        options = { ...options, lastModDate: timestamp };
      }
      const imgReader = await imageSource.readImage();
      await zipWriter.add(
        `OEBPS/${imageInfo.destPath}`,
        "getReader" in imgReader
          ? imgReader
          : new zip.Uint8ArrayReader(imgReader),
        options,
      );
    }
  }

  await zipWriter.close();
}
