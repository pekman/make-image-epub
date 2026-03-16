import { toXast } from "hast-util-to-xast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";
import { x } from "xastscript";

import type { EpubParameters } from "./epub-parameters.js";


/** Image caption.
 *
 * (Opaque branded type)
 */
export type Caption = object & { readonly __brand: "Caption" };


const parseMarkdownCaption = (markdown: string): Caption =>
  toXast(
    toHast(
      fromMarkdown(
        markdown,
        {
          extensions: [{
            // Disable parsing html tags. Parse them as text.
            disable: { null: ["htmlFlow", "htmlText"] },
          }],
        },
      )
    )
  ) as unknown as Caption;

function parseTextCaption(
  text: string,
  epubParameters: EpubParameters,
): Caption {
  switch (epubParameters.txtFormatting) {

    case "flow":
    case undefined:
      return x(null,  // document fragment of <p> elements
        text
          .trim()
          .split(/\n\s*\n/)
          .map((paragraph) => x("p", paragraph.trim())),
      ) as unknown as Caption;

    case "verbatim":
      return x("pre", text) as unknown as Caption;

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
