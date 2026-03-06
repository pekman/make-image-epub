import { argv, exit, stdout } from "node:process";
import { makeEpub, type ImageSource } from "./make-epub.js";
import { open, stat } from "node:fs/promises";


const [, , title, epubFilename, ...imgFilenames] = argv;
if (title == null || epubFilename == null) {
  console.error(`usage ${argv[1]} title EPUB_filename image...`);
  exit(1);
}


class ImageReader implements ImageSource {
  constructor(public readonly filename: string) {}

  async *readImage() {
    await using f = await open(this.filename);
    yield* f.createReadStream();
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

const writeEpub = (epubFile: { write(chunk: Uint8Array): void }) =>
  makeEpub(
    imgFilenames.map((filename) => new ImageReader(filename)),
    {
      title,
      language: "en",
    },
    (_err, data, _final) => {
      epubFile.write(data);
    });

if (epubFilename === "-") {
  await writeEpub(stdout);
}
else {
  await using epub = await open(epubFilename, "wx");
  await writeEpub(epub);
}
