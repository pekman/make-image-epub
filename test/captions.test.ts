import { assert, expect, test } from "vitest";
import { captionParserByExtension } from "../src/captions.js";


const MULTI_PARAGRAPH_CAPTION = `\


First paragraph. Empty lines above must be ignored; there is no empty
paragraph at the start.

Second paragraph.



Third and last paragraph. More than 1 empty lines must be handled as
one paragraph break; there is no empty paragraph above. Empty lines
below must be ignored; there is no empty paragraph at the end.


`;


type Ext = keyof typeof captionParserByExtension;

test.each([
  "txt",
  "markdown",
] satisfies Ext[])("paragraph splitting with %s", (ext) => {

  const paragraphs = captionParserByExtension[ext](MULTI_PARAGRAPH_CAPTION);
  assert("children" in paragraphs);

  // Filter out "\n" text nodes that Markdown parser generates for
  // some reason. They are unnecessary but shouldn't change how the
  // resulting xhtml is displayed.
  const children = paragraphs.children.filter((node) =>
    !(node.type === "text" && node.value === "\n")
  );

  for (const p of children) {
    assert.propertyVal(p, "type", "element");
    assert(p.type === "element");
    expect(p).toHaveProperty("name", "p");
    for (const child of p.children) {
      if (child != null) {
        assert(child.type === "text");
        expect.soft(child.value, "empty paragraph").not.toMatch(/^\s*$/);
      }
    }
  }

  expect(children, "wrong number of paragraphs").toHaveLength(3);
});
