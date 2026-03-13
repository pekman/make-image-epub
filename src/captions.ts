import { toXast } from "hast-util-to-xast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";
import type { Nodes } from "xast";
import { x } from "xastscript";

import type { EpubParameters } from "./epub-parameters.js";


const parseMarkdownCaption = (markdown: string): Nodes =>
  toXast(
    toHast(
      fromMarkdown(markdown)));

function parseTextCaption(text: string, epubParameters: EpubParameters): Nodes {
  switch (epubParameters.txtFormatting) {

    case "flow":
    case undefined:
      return x(null,  // document fragment of <p> elements
        text
          .trim()
          .split(/\n\s*\n/)
          .map((paragraph) => x("p", paragraph.trim())),
      );

    case "verbatim":
      return x("pre", text);

    case "markdown":
      return parseMarkdownCaption(text);

    default: {
      const _exhaustiveCheck: never = epubParameters.txtFormatting;
      throw new Error(`Unknown txt formatting: ${_exhaustiveCheck}`);
    }
  }
}


export const captionParserByExtension = {
  markdown: parseMarkdownCaption,
  md: parseMarkdownCaption,
  txt: parseTextCaption,
} as const;
