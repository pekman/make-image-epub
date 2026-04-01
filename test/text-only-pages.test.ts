import * as zip from "@zip.js/zip.js";
import { assert, expect, it, test, vi, type MockedClass } from "vitest";

import { makeEpub } from "../src/make-epub.js";


const ZipWriterMockClass = vi.hoisted(() => class {
  add = vi.fn<zip.ZipWriter<unknown>["add"]>();
  close = vi.fn();
});

vi.mock("@zip.js/zip.js", () => ({
  ZipWriter: vi.fn(ZipWriterMockClass),
  TextReader: vi.fn(class {
    constructor(public readonly text: string) {}
  }),
  Uint8ArrayReader: vi.fn(),
}));

const ZipWriterMock = zip.ZipWriter as unknown as MockedClass<
  typeof ZipWriterMockClass
>;


async function makeEpubWithCaptions(
  pages: [string, string][],
): Promise<Record<string, unknown>> {
  ZipWriterMock.mockClear();

  await makeEpub(
    pages.map(([filename, caption]) => ({
      filename,
      readImage: async () => new Uint8Array(),
      readCaption: async () => caption,
    })),
    { title: "test title", language: "en" },
    new WritableStream(),  // no-op writable sink
  );

  const constructedZipWriter = ZipWriterMock.mock.results.at(-1);
  assert(constructedZipWriter?.type === "return");
  const zipWriterAddMock = constructedZipWriter.value.add;

  const files: Record<string, unknown> = {};
  for (const [filename, contents] of zipWriterAddMock.mock.calls) {
    files[filename] =
      contents && typeof contents === "object" && "text" in contents
        ? contents.text
        : "(data)";
  }
  return files;
}


test("text-only page without captions", async () => {
  const files = await makeEpubWithCaptions([
    ["test.txt", "this is a caption-only page"],
  ]);

  const pageText = files["OEBPS/test.xhtml"];
  assert(typeof pageText === "string");
  expect(pageText).toContain("this is a caption-only page");
  expect(pageText).not.toContain("<img ");
  expect(pageText).not.toContain("<video ");
  expect(pageText).not.toContain("<audio ");
});

it("should not add text file to manifest", async () => {
  const files = await makeEpubWithCaptions([
    ["test.txt", "this is a caption-only page"],
  ]);

  const contentOpf = files["OEBPS/content.opf"];
  assert(typeof contentOpf === "string");
  expect(contentOpf).toContain("test.xhtml");
  expect(contentOpf).not.toContain("test.txt");
});
