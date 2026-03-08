import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { argv, exit, stdout } from "node:process";
import { Readable, Writable } from "node:stream";
import * as pathe from "pathe";

import { CAPTION_EXTENSIONS, parseTextCaption } from "./captions.js";
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

  async readCaption() {
    // Try to form caption filename candidates from image filename
    // without and with extension, i.e. name.txt first, then
    // name.jpg.txt
    const basenameCandidates = [this.filename];
    const ext = pathe.extname(this.filename);
    if (ext !== "") {
      basenameCandidates.unshift(this.filename.slice(0, -ext.length));
    }

    async function tryRead(path: string) {
      let text;
      try {
        text = await readFile(path, { encoding: "utf-8" });
      }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          // file not found
          return null;
        }
        throw err;
      }

      if (text.startsWith("\uFEFF")) {
        text = text.slice(1);  // strip BOM
      }
      return text;
    }

    // search for possible caption files
    for (const ext of CAPTION_EXTENSIONS) {
      for (const basename of basenameCandidates) {
        const text = await tryRead(`${basename}.${ext}`);
        if (text != null) {
          return parseTextCaption(text);
        }
      }
    }
    return null;
  }

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
