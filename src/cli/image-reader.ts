import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, sep as pathSep } from "node:path";
import { Readable } from "node:stream";

import { captionParserByExtension } from "../captions.js";
import type { EpubParameters } from "../epub-parameters.js";
import type { ImageSource } from "../make-epub.js";


export class ImageReader implements ImageSource {
  public readonly filename: string;

  constructor(
    filename: string,
    public readonly epubParameters: EpubParameters,
    private readonly onFinished?: () => void,
  ) {
    // replace \ with / on Windows
    this.filename = filename.replaceAll(pathSep, "/");
  }

  async readImage(): Promise<ReadableStream<Uint8Array>> {
    const stream = createReadStream(this.filename);
    if (this.onFinished) {
      stream.on("end", this.onFinished);
    }
    return Readable.toWeb(stream);
  }

  async readCaption() {
    // Try to form caption filename candidates from image filename
    // without and with extension, i.e. name.txt first, then
    // name.jpg.txt
    const basenameCandidates = [this.filename];
    const ext = extname(this.filename);
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

    // Search for possible caption files. Try different supported
    // file extensions with lower, title, and upper case.
    for (const [ext, parser] of Object.entries(captionParserByExtension)) {
      const extCaseVariants = [
        ext,
        ext.slice(0, 1).toUpperCase() + ext.slice(1),
        ext.toUpperCase(),
      ];
      for (const extVariant of extCaseVariants) {
        for (const basename of basenameCandidates) {
          const text = await tryRead(`${basename}.${extVariant}`);
          if (text != null) {
            return parser(text, this.epubParameters);
          }
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
