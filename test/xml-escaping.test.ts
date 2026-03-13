import * as zip from "@zip.js/zip.js";
import { expect, test, vi, type MockedClass } from "vitest";
import { captionParserByExtension } from "../src/captions.js";
import type { EpubParameters } from "../src/epub-parameters.js";
import { makeEpub } from "../src/make-epub.js";

vi.mock("@zip.js/zip.js", { spy: true });

const TextReaderMock = zip.TextReader as unknown as MockedClass<
  typeof zip.TextReader
>;

async function makeEpubWithCaption(
  ext: typeof EXTENSIONS[number],
  caption: string,
  epubExtraParameters?: Partial<EpubParameters>,
) {
  TextReaderMock.mockClear();

  const epubParameters = {
    title: "test title",
    language: "en",
    ...epubExtraParameters,
  };
  await makeEpub(
    [{
      filename: "test.png",
      readImage: async () => new Uint8Array(),
      readCaption: async () => captionParserByExtension[ext](
        caption,
        epubParameters,
      ),
    }],
    epubParameters,
    new WritableStream(),  // no-op writable sink
  );

  expect(TextReaderMock).toHaveBeenCalled();
  const pageXhtml = TextReaderMock.mock.calls.find(
    ([text]) => text.includes("=TEST=")
  )?.[0];
  expect(
    pageXhtml,
    "test.xhtml not found or recognized",
  ).not.toBeNullable();

  return pageXhtml;
}

test.for([
  { title: "=TEST= <not-a-tag> &not-an-entity;" },
  { creator: ["=TEST= <not-a-tag> &not-an-entity;"] },
])("XML escaping in metadata field: %j", async (params) => {
  const pageXhtml = await makeEpubWithCaption("txt", "", params);

  expect(pageXhtml).toMatch(
    /=TEST= (&lt;|&#x3C;)not-a-tag(>|&gt;|&#x3E;) &(amp|#x26);not-an-entity;/
  );
});

test("XML escaping with txt caption", async () => {
  const pageXhtml = await makeEpubWithCaption(
    "txt",
    "=TEST= <not-a-tag> &not-an-entity;"
  );

  expect(pageXhtml).toMatch(
    /=TEST= (&lt;|&#x3C;)not-a-tag(>|&gt;|&#x3E;) &(amp|#x26);not-an-entity;/
  );
});

test("XHTML escaping and tag removal with Markdown caption", async () => {
  const pageXhtml = await makeEpubWithCaption(
    "markdown",
    "=TEST= <not-a-tag> &not-an-entity;"
  );

  expect(pageXhtml).toMatch(/=TEST= {1,2}&(amp|#x26);not-an-entity;/);
});


const EXTENSIONS = [
  "txt",
  "markdown",
] as const satisfies (keyof typeof captionParserByExtension)[];

// TODO: Fails because these characters not filtered. Needs fix.
test.fails.for(EXTENSIONS)("unallowed character removal with %s", async (ext) => {
  const pageXhtml = await makeEpubWithCaption(
    ext,
    // see https://www.w3.org/TR/xml11/#charsets
    "=TEST=" +
    "\x00\uFFFE\uFFFF\uD888" +  // not allowed
    "-" +
    "\x07\x7F" +  // "restricted"
    "-" +
    "\uFDDF\u{1FFFF}" +  // "discouraged"
    "=END OF TEST="
  );

  expect(pageXhtml).toMatch(/=TEST=\uFFFD*-\uFFFD*-\uFFFD*=END OF TEST=/);
});
