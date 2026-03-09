import * as zip from "@zip.js/zip.js";
import * as mime from "mime-types";
import * as pathe from "pathe";
import { toXml } from "xast-util-to-xml";
import type { Result } from "xastscript";

import type { EpubParameters } from "./epub-parameters.js";

import containerXml from "./epub-static/container.xml" with { type: "bytes" };
import styleCss from "./epub-static/style.css" with { type: "bytes" };


const ZIP_OPTIONS = {
  level: 9,
  extendedTimestamp: false,
} as const satisfies zip.ZipWriterAddDataOptions;


export interface ImageSource {
  filename: string;

  readImage(): Promise<ReadableStream<Uint8Array> | Uint8Array>;
  getTimestamp?(): Promise<Date | null | undefined>;
  readCaption?(): Promise<string | Result | null | undefined>;
}


class ImageInfo {
  /** source filename */
  readonly srcPath: string;

  /** filename in zip file without directory */
  readonly destFilename: string;

  /** image name shown to user */
  readonly displayedName: string;

  readonly mimetype: string;

  constructor(srcPath: string) {
    this.srcPath = pathe.normalize(srcPath);

    const parts = pathe.parse(this.srcPath);
    this.destFilename = parts.base;
    // TODO: handle unallowed characters in destFilename
    // TODO: handle destFilename collisions
    this.displayedName = parts.name;

    let mimetype = mime.lookup(srcPath);
    if (!mimetype) {
      console.warn("Warning: Cannot determine file type for %o", srcPath);
      mimetype = "application/octet-stream";
    }
    else if (!mimetype.startsWith("image/")) {
      console.warn(
        "Warning: %o is not an image. It is %o.",
        srcPath, mimetype);
    }
    this.mimetype = mimetype;
  }
}


// <?xml …?> declaration as returned by unist-builder/u()
const XML_DECLARATION = {
  type: "instruction",
  name: "xml",
  value: 'version="1.0" encoding="UTF-8"',
} as const;

const makeXml = (tree: Result) => toXml(
  [XML_DECLARATION, tree],
  { closeEmptyElements: true });


const imageFilenameToXhtmlFilename = (imgName: string) =>
  `${pathe.parse(imgName).name}.xhtml`;


const makeContentOpf = (
  images: ImageInfo[],
  epubParameters: EpubParameters,
) => {
  // Globally unique document ID. Must be valid XML identifier, which
  // means it can't start with a number.
  const id = crypto.randomUUID().replace(/^\d/, "_$&");

  // Current time in format YYYY-MM-DDThh:mm:ssZ
  const now = new Date().toISOString()
    .replace(/\.\d+/, "");  // remove fractional part of seconds

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

        {/* TODO: other metadata here, especially dc:creator */}
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
          images.entries().flatMap(([i, { destFilename, mimetype }]) => [
            <item
              id={`page-${i + 1}`}
              href={imageFilenameToXhtmlFilename(destFilename)}
              media-type="application/xhtml+xml"
            />
            ,
            <item
              id={`image-${i + 1}`}
              href={destFilename}
              media-type={mimetype}
            />
          ]).toArray()
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
  images: ImageInfo[],
  epubParameters: EpubParameters,
) => makeXml(
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
        <ol>
          {images.map(({ destFilename, displayedName }) =>
            <li>
              <a href={imageFilenameToXhtmlFilename(destFilename)}>
                {displayedName}
              </a>
            </li>
          )}
        </ol>
      </nav>
    </body>
  </html>
);


const makePageXhtml = (
  image: ImageInfo,
  caption: string | Result | null | undefined,
  epubParameters: EpubParameters,
) => makeXml(
  <html
    xmlns="http://www.w3.org/1999/xhtml"
    lang={epubParameters.language}
  >
    <head>
      <title>{epubParameters.title}</title>
      <link rel="stylesheet" href="style.css" />
    </head>
    <body>
      <img src={image.destFilename} />
      {caption != null
        ? <div id="caption">{caption}</div>
        : null
      }
    </body>
  </html>
);


export async function makeEpub(
  imageSources: ImageSource[],
  epubParameters: EpubParameters,
  outputStream: WritableStream,
) {
  const imageInfos = imageSources.map((imgSrc) =>
    new ImageInfo(imgSrc.filename));

  const zipWriter = new zip.ZipWriter(outputStream);

  const addFile = (filename: string, data: string | Uint8Array) =>
    zipWriter.add(
      filename,
      typeof data === "string"
        ? new zip.TextReader(data)
        : new zip.Uint8ArrayReader(data),
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
    const imageSource = imageSources[i] as ImageSource;
    const imageInfo = imageInfos[i] as ImageInfo;

    // add page xhtml
    await addFile(
      `OEBPS/${imageFilenameToXhtmlFilename(imageInfo.destFilename)}`,
      makePageXhtml(
        imageInfo,
        await imageSource.readCaption?.(),
        epubParameters,
      ),
    );

    // add image
    let options: zip.ZipWriterAddDataOptions = ZIP_OPTIONS;
    const timestamp = await imageSource.getTimestamp?.();
    if (timestamp != null) {
      options = { ...options, lastModDate: timestamp };
    }
    const imgReader = await imageSource.readImage();
    await zipWriter.add(
      `OEBPS/${imageInfo.destFilename}`,
      "getReader" in imgReader
        ? imgReader
        : new zip.Uint8ArrayReader(imgReader),
      options,
    );
  }

  await zipWriter.close();
}
