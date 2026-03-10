import { createWriteStream } from "node:fs";
import { argv, stdout } from "node:process";
import { Writable } from "node:stream";
import yargs, { type Arguments } from "yargs";

import { makeEpub } from "../make-epub.js";
import { ImageReader } from "./image-reader.js";


interface CliArgs {
  title: string;
  epubFilename: string;
  images: string[];
  language: string;
}

const args = yargs(argv.slice(2))
  .alias("help", "h")
  .command(
    "$0 [--language=CODE] <title> <epub-filename> <images...>",
    // "$0",
    "Create EPUB document from image files and text captions.",
    (yargs) => yargs
      .positional("title", {
        type: "string",
        describe: "EPUB document title",
      })
      .positional("epub-filename", {
        type: "string",
        describe: 'output EPUB file ("-" = pipe to stdout)',
      })
      .positional("images", {
        type: "string",
        array: true,
        describe: "source image",
      })
      .option("language", {
        alias: "l",
        type: "string",
        requiresArg: true,
        default: "en",
        describe: "EPUB language. " +
          'RFC 5646 language code, such as "en" or "en-GB".',
      }),
  )
  .strict()
  .parseSync() as Arguments<CliArgs>;

const { epubFilename, images } = args;
await makeEpub(
  images.map((filename) => new ImageReader(filename)),
  args,
  Writable.toWeb(
    epubFilename === "-"
      ? stdout
      : createWriteStream(epubFilename, { flags: "wx" })
  ),
);
