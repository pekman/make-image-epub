import { createWriteStream } from "node:fs";
import { argv, exit, stdout } from "node:process";
import { Writable } from "node:stream";

import { makeEpub } from "../make-epub.js";
import { ImageReader } from "./image-reader.js";


const [, , title, epubFilename, ...imgFilenames] = argv;
if (title == null || epubFilename == null) {
  console.error(`usage ${argv[1]} title EPUB_filename image...`);
  exit(1);
}

await makeEpub(
  imgFilenames.map((filename) => new ImageReader(filename)),
  {
    title,
    language: "en",
  },
  Writable.toWeb(
    epubFilename === "-"
      ? stdout
      : createWriteStream(epubFilename, { flags: "wx" })
  ),
);
