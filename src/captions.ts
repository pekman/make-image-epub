import { x } from "xastscript";

export const CAPTION_EXTENSIONS = ["txt", "TXT"] as const;

export function parseTextCaption(text: string) {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => x("p", paragraph.trim()));
  return x(null, [...paragraphs]);  // document fragment of <p> elements
}
