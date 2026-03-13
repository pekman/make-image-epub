import epubchecker from "epubchecker";
import { createWriteStream } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";

import { ImageReader } from "../src/cli/image-reader.js";
import { makeEpub } from "../src/make-epub.js";
import { test } from "./tmpdir.js";


test("EPUB spec conformance", async ({ tmpdir }) => {
  const testEpubPath = path.join(tmpdir, "test.epub");

  const epubParameters = {
    title: "test title",
    language: "en",
  };
  const imageReaders = await Array.fromAsync(
    glob(path.join(import.meta.dirname, "data", "*.png")),
    (path) => new ImageReader(path, epubParameters),
  );
  await makeEpub(
    imageReaders,
    epubParameters,
    Writable.toWeb(createWriteStream(testEpubPath, { flags: "wx" })),
  );

  const report = await epubchecker(testEpubPath, {
    includeWarnings: true,
    includeNotices: true,
  });

  const { nFatal, nError, nWarning } = report.checker;
  if (nFatal !== 0 || nError !== 0 || nWarning !== 0) {
    console.log("Messages from epubcheck:");
    console.dir(report.messages, { depth: Infinity });
    throw new Error("Conformance check failed");
  }
});
