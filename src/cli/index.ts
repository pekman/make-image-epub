import { createWriteStream } from "node:fs";
import { argv, stdout } from "node:process";
import { Writable } from "node:stream";
import yargs, { type Arguments } from "yargs";

import {
  getDublinCoreKeyInfo,
  type DublinCoreMetadata,
} from "../epub-parameters.js";
import { makeEpub } from "../make-epub.js";
import { ImageReader } from "./image-reader.js";
import { findImages } from "./find-images.js";


interface CliArgs extends DublinCoreMetadata {
  title: string;
  epubFilename: string;
  imagesOrDirectories: string[];
  language: string;
}

const args = yargs(argv.slice(2))
  .alias("help", "h")
  .command(
    "$0 [options] <title> <epub-filename> <images-or-directories...>",
    "Create EPUB document from image files and text captions.",
    (yargs) => {
      // Coercion function factory for options that don't support
      // multiple values
      const onlyOneValue = (optname: string) => <T>(val: T | T[]) => {
        if (Array.isArray(val)) {
          throw new Error(`only one --${optname} option allowed`);
        }
        return val;
      };

      // Coercion function for options that support multiple values.
      // Ensures that the value is an array.
      const ensureArray = <T>(val: T | T[]) =>
        Array.isArray(val) ? val : [val];

      yargs
        .positional("title", {
          type: "string",
          describe: "EPUB document title",
        })
        .positional("epub-filename", {
          type: "string",
          describe: 'output EPUB file ("-" = pipe to stdout)',
        })
        .positional("images-or-directories", {
          type: "string",
          array: true,
          describe: "source images or directories. " +
            "Directories are searched recursively. Images within a " +
            "directory are sorted in natural order (numbers in " +
            "filenames are compared numerically).",
        })
        .option("language", {
          group: "Document options:",
          alias: "l",
          type: "string",
          requiresArg: true,
          coerce: onlyOneValue("language"),
          default: "en",
          describe: "EPUB language. " +
            'RFC 5646 language code, such as "en" or "en-GB".',
        });

      const group = "Dublin Core metadata options:" +
        "\n\n  " +
        "Optional Dublin Core metadata fields." +
        "\n\n  " +
        "Some fields can be prefixed with 3-letter role identifier " +
        "and a colon, e.g. 'art:Name' for artist. For identifier " +
        "descriptions, see " +
        "<https://id.loc.gov/vocabulary/relators.html>" +
        "\n\n  " +
        "For field descriptions, see " +
        "<https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#section-3>" +
        "\n";

      for (const [name, info] of getDublinCoreKeyInfo()) {
        yargs.option(name, {
          group,
          type: "string",
          requiresArg: true,
          alias: {
            creator: "c",
            date: "d",
          }[name],
          describe: [
            info?.help,
            info?.noMultiple ? null : "Can be given multiple times.",
            info?.supportsRole && "Supports role identifier.",
          ].filter((item) => item).join(" "),
          coerce: (val: string | string[]) =>
            (info?.noMultiple
              ? [onlyOneValue(name)(val)]
              : ensureArray(val)
            ).map(info?.converter ?? ((val) => val)),
        })
      }
    },
  )
  .strict()
  .parseSync() as Arguments<CliArgs>;

const { epubFilename, imagesOrDirectories } = args;

const images = await Array.fromAsync(findImages(imagesOrDirectories));

await makeEpub(
  images.map((filename) => new ImageReader(filename)),
  args,
  Writable.toWeb(
    epubFilename === "-"
      ? stdout
      : createWriteStream(epubFilename, { flags: "wx" })
  ),
);
