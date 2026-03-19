#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { basename } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { Writable } from "node:stream";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import wrap from "word-wrap";

import { paragraphs } from "../docstring-helper.js";
import {
  getDublinCoreKeyInfo,
  TxtCaptionFormatting,
  type EpubParameters,
} from "../epub-parameters.js";
import { makeEpub } from "../make-epub.js";
import { findImages } from "./find-images.js";
import { ImageReader } from "./image-reader.js";

import packageJson from "../../package.json" with { type: "json" };


const options: ParseArgsOptionsConfig = {
  help: {
    type: "boolean",
    short: "h",
  },
  language: {
    type: "string",
    short: "l",
    default: "en",
  },
  "txt-formatting": {
    type: "string",
  },
  overwrite: {
    type: "boolean",
    short: "f",
  },
  "no-progress": {
    type: "boolean",
    short: "q",
  },
};

const getDublinCoreShortOpt = (opt: string) => ({
  creator: "c",
  date: "d",
})[opt];

for (const [key] of getDublinCoreKeyInfo()) {
  const short = getDublinCoreShortOpt(key);
  options[key] = {
    type: "string",
    multiple: true,  // always return array, but check it later if noMultiple
    ...(short && { short }),
  };
}


function usage() {
  // Note: Neither word-wrap package nor String.length is Unicode- or
  // ANSI-escape-aware. Things that will break this code include
  // Unicode modifier characters, wide characters, and ANSI escapes.

  const screenWidth = Math.max(20, stderr.columns ?? 72);

  const print = (indent: number = 0, text: string = "") =>
    console.error(wrap(text, {
      width: screenWidth - indent,
      indent: " ".repeat(indent),
      trim: true,
    }));

  function print2Col(
    indent: number,
    spacing: number,
    ...lines: [string, string][]
  ) {
    const col1Width = indent + Math.max(...lines.map(([col1]) => col1.length));
    const col2Width = screenWidth - col1Width - spacing;
    if (col2Width >= 20) {
      const options = {
        width: col2Width,
        indent: " ".repeat(col1Width + spacing),
        trim: true,
      };
      for (const [col1, col2] of lines) {
        console.error(
          " ".repeat(indent) + col1 +
            wrap(col2, options).slice(indent + col1.length)
        );
      }
    }
    else {
      // put column 2 to next line indented with 2 more spaces
      const options = {
        width: screenWidth - indent - 2,
        indent: " ".repeat(indent + 2),
        trim: true,
      };
      for (const [col1, col2] of lines) {
        console.error(" ".repeat(indent) + col1);
        console.error(wrap(col2, options));
      }
    }
  }

  print2Col(0, 1, [
    `Usage: ${basename(String(argv[1]))}`,
    "[options] <title> <epub-filename> <images-or-directories...>",
  ]);
  print();
  print(0, packageJson.description +
    (packageJson.description.endsWith(".") ? "" : "."))
  print();
  print(0, "Positional arguments:");
  print2Col(2, 2,
    ["title", "EPUB document title"],
    ["epub-filename", 'output EPUB file ("-" = pipe to stdout)'],
    ["images-or-directories", paragraphs`
      source images or directories. Directories are searched
      recursively. Images within a directory are sorted in natural
      order (numbers in filenames are compared numerically).
    `],
  )
  print();
  print(0, "Document options:");
  print2Col(2, 2,
    [
      "-l, --language=…",
      'EPUB language. RFC 5646 language code, such as "en" or en-GB.' +
      ` Default: "${options["language"]?.default}"`
    ],
  );
  print();
  print(0, "Document metadata options:");
  print();
  print(2, paragraphs`
    Optional Dublin Core metadata fields.

    Some fields can be prefixed with 3-letter role identifier and a
    colon, e.g. "art:Name" for artist. For identifier descriptions,
    see <https://id.loc.gov/vocabulary/relators.html>

    For field descriptions, see
    <https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#section-3>
  `);
  print();
  print2Col(2, 2,
    ...getDublinCoreKeyInfo().map<[string, string]>(([key, info]) => [
      ((short) => short ? `-${short}, ` : "")(getDublinCoreShortOpt(key)) +
        `--${key}=…`,
      [
        info?.help,
        info?.noMultiple ? null : "Can be given multiple times.",
        info?.supportsRole && "Supports role identifier.",
      ].filter((item) => item).join(" "),
    ]),
  );
  print();
  print(0, "Other options:");
  print2Col(2, 2,
    ["--txt-formatting=…",
      "formatting for captions from .txt files.\nValues:\n\n" +
      Object.entries(TxtCaptionFormatting).map(([key, val]) =>
        `${key}:\n${val}\n\n`
      ).join(""),
    ],
    ["-f, --overwrite", "overwrite output file if it exists"],
    ["-q, --no-progress", "don't show progress"],
    ["-h, --help", "show help"],
  );
  print();
  print(0, "Captions");
  print();
  print(2, paragraphs`
    Each image can have an optional caption in a separate file. A
    caption file must have the same base name as the image but a
    different extension. E.g. "image1.jpg" should have its caption in
    "image1.txt". Allowed extensions are ".txt" for plain text and
    ".md" for Markdown.

    Markdown is parsed according to CommonMark
    <https://commonmark.org/>. Embedded HTML is not supported.
  `);
  print();
}


// parse and validate args
let parseResult;
try {
  parseResult = parseArgs({
    options,
    allowPositionals: true,
  });

  for (const [key, info] of getDublinCoreKeyInfo()) {
    if (key in parseResult.values) {
      const values = parseResult.values[key] as string[];
      if (info?.noMultiple && values.length > 1) {
        throw new Error(`Only single --${key} allowed`);
      }
      if (info?.converter) {
        parseResult.values[key] = values.map((val) => info.converter!(val));
      }
    }
  }

  const txtFmt = parseResult.values["txt-formatting"] as string | undefined;
  if (!(txtFmt == null || txtFmt in TxtCaptionFormatting)) {
    throw new Error("Invalid --txt-formatting value");
  }
}
catch (err) {
  if (!err || typeof err !== "object" || !("message" in err))
    throw err;
  console.error(err.message);
  console.error();
  usage();
  exit(1);
}

const {
  positionals: [ title, epubFilename, ...imagesOrDirectories ],
  values: {
    help,
    "txt-formatting": txtFormatting,
    overwrite,
    "no-progress": noProgress,
    ...otherOpts
  },
} = parseResult;

if (help) {
  usage();
  exit(0);
}
if (title == null || epubFilename == null || imagesOrDirectories.length == 0) {
  console.error("Missing positional arguments");
  console.error();
  usage();
  exit(1);
}

const args: EpubParameters = {
  ...otherOpts as unknown as EpubParameters,
  title,
  txtFormatting: txtFormatting as EpubParameters["txtFormatting"],
};


const images = await Array.fromAsync(findImages(imagesOrDirectories));

let onProgress = undefined;
if (!noProgress) {
  let done = -1;
  onProgress = () => stderr.write(
    `\r${++done}/${images.length} images processed (${
      Math.round(100*done/images.length)
    }%)`);
  onProgress();
}

await makeEpub(
  images.map((filename) => new ImageReader(filename, args, onProgress)),
  args,
  Writable.toWeb(
    epubFilename === "-"
      ? stdout
      : createWriteStream(epubFilename, { flags: overwrite ? "w" : "wx" })
  ),
);

if (!noProgress) {
  console.error();
}
