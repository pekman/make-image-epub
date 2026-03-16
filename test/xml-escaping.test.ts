import * as zip from "@zip.js/zip.js";
import { assert, expect, test, vi, type MockedClass } from "vitest";

import { captionParserByExtension } from "../src/captions.js";
import type { EpubParameters } from "../src/epub-parameters.js";
import { makeEpub } from "../src/make-epub.js";


const EXTENSIONS = [
  "txt",
  "markdown",
] as const satisfies (keyof typeof captionParserByExtension)[];


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
  assert(pageXhtml != null, "test string should be found in a file in EPUB");

  return /=TEST=(.*)=\/TEST=/s.exec(pageXhtml)?.[1];
}


test.for([
  { title: "=TEST= <not-a-tag> &not-an-entity; =/TEST=" },
  { creator: ["=TEST= <not-a-tag> &not-an-entity; =/TEST="] },
])("XML escaping in metadata field: %j", async (params) => {
  const testStr = await makeEpubWithCaption("txt", "", params);

  expect(testStr).toMatch(
    /^ (&lt;|&#x3C;)not-a-tag(>|&gt;|&#x3E;) &(amp|#x26);not-an-entity; $/
  );
});

test.for(EXTENSIONS)("XML escaping in %s caption", async (ext) => {
  const testStr = await makeEpubWithCaption(
    ext,
    "=TEST= <not-a-tag> &not-an-entity; =/TEST="
  );

  expect(testStr).toMatch(
    /^ (&lt;|&#x3C;)not-a-tag(>|&gt;|&#x3E;) &(amp|#x26);not-an-entity; $/
  );
});


test("unallowed character removal in title", async () => {
  const testStr = await makeEpubWithCaption(
    "txt",
    "",
    { title: "=TEST=\x00-\x01-\uFFFE-\uFFFF-\uD888=/TEST=" },
  );

  // Apparently something in the Unified ecosystem removes ASCII
  // control characters before our code has a chance to replace them
  // with replacement character \uFFFD. For some reason, it doesn't
  // strip other unallowed characters. Either way is fine (but creates
  // confusing test cases).
  expect(testStr).toEqual("--\uFFFD-\uFFFD-\uFFFD");
});

test.for(
  EXTENSIONS,
)("unallowed character removal in %s caption", async (ext) => {
  const testStr = await makeEpubWithCaption(
    ext,
    "=TEST=\x00-\x01-\uFFFE-\uFFFF-\uD888=/TEST=",
  );

  // See note above. Additionally, it seems that something in Markdown
  // pipeline replaces \x00 with \uFFFD instead on removing it. Either
  // way is fine, but we have to handle both cases.
  expect(testStr).toMatch(/^\uFFFD?--\uFFFD-\uFFFD-\uFFFD$/);
});
