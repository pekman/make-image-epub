import { toXast } from "hast-util-to-xast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";
import { x } from "xastscript";


function parseTextCaption(text: string) {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => x("p", paragraph.trim()));
  return x(null, [...paragraphs]);  // document fragment of <p> elements
}

const parseMarkdownCaption = (markdown: string) =>
  toXast(
    toHast(
      fromMarkdown(markdown)));


export const captionParserByExtension = {
  markdown: parseMarkdownCaption,
  md: parseMarkdownCaption,
  txt: parseTextCaption,
} as const;
