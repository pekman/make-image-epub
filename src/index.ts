import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { argv, exit, stdout } from "node:process";
import { Readable, Writable } from "node:stream";

import { makeEpub, type ImageSource } from "./make-epub.js";


const [, , title, epubFilename, ...imgFilenames] = argv;
if (title == null || epubFilename == null) {
  console.error(`usage ${argv[1]} title EPUB_filename image...`);
  exit(1);
}


class ImageReader implements ImageSource {
  constructor(public readonly filename: string) {}

  async readImage(): Promise<ReadableStream<Uint8Array>> {
    return Readable.toWeb(createReadStream(this.filename));
  }

  async readCaption() { return "TODO: add caption handling"; }

  async getTimestamp() {
    try {
      const s = await stat(this.filename);
      return s.mtime;
    }
    catch (err) {
      console.warn("Error reading timestamp for %o: %o", this.filename, err);
      return null;
    }
  }
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
