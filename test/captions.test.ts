import { assert, expect, test } from "vitest";
import { parseTextCaption } from "../src/captions.js";


const MULTI_PARAGRAPH_CAPTION = `\


First paragraph. Empty lines above must be ignored; there is no empty
paragraph at the start.

Second paragraph.



Third and last paragraph. More than 1 empty lines must be handled as
one paragraph break; there is no empty paragraph above. Empty lines
below must be ignored; there is no empty paragraph at the end.


`;


test("paragraph splitting", () => {
  const paragraphs = parseTextCaption(MULTI_PARAGRAPH_CAPTION);

  for (const p of paragraphs.children) {
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

  expect(paragraphs.children, "wrong number of paragraphs").toHaveLength(3);
});
