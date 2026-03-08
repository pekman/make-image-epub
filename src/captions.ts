import { x } from "xastscript";

export const CAPTION_EXTENSIONS = ["txt", "TXT"] as const;

export function parseTextCaption(text: string) {
  const paragraphs = text
    .matchAll(/(?:^\s*\n)?(.+?)(?:\n\s*\n|\n?$)/g)
    .map(([, paragraph]) => x("p", paragraph));
  return x(null, [...paragraphs]);  // document fragment of <p> elements
}
