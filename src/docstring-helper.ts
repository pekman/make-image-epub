import stripIndent from "strip-indent";

/** Split template literal into paragraphs and join lines within paragraph.
 *
 * Strip indentation according to shortest indentation.
 */
export const paragraphs = (
  [str]: readonly string[],
  _?: never,  // eslint-disable-line @typescript-eslint/no-unused-vars
) => stripIndent(str!)
  .replace(/^\n|\n[ \t]*$/g, "")
  .replace(/^\n|(?<=\n)\n|\n(?=\n)|\n$/g, "\x00")
  .replaceAll("\n", " ")
  .replaceAll("\x00", "\n");
