import pathe from "pathe";
import { caseFold } from "unicode-case-folding";


export class InvalidPathError extends Error {
  constructor(path: string) {
    super(`Invalid path: ${path}`);
  }
}


class UnicodeNormalizedCaseFoldedSet {
  private readonly set = new Set<string>();

  private static normalize(val: string) {
    // normalize string as per
    // https://www.w3.org/TR/charmod-norm/#CanonicalFoldNormalizationStep
    const nfd = val.normalize("NFD");
    const casefolded = caseFold(nfd);
    return casefolded.normalize("NFC");
  }

  add(item: string) {
    this.set.add(UnicodeNormalizedCaseFoldedSet.normalize(item));
  }

  has(item: string) {
    return this.set.has(UnicodeNormalizedCaseFoldedSet.normalize(item));
  }
}

/**
 * Convert filenames to conform with EPUB specs avoiding name collisions.
 *
 * See: https://www.w3.org/TR/epub-33/#sec-container-filenames
 */
export class FilenameMangler {
  private readonly alreadySeen = new UnicodeNormalizedCaseFoldedSet();

  private static readonly utf8Encoder = new TextEncoder();
  private static readonly forbiddenFilenameChars = new RegExp(
    "[" +
    // rules from https://www.w3.org/TR/epub-33/#sec-container-filenames

    " " +  // "For compatibility [...] file names SHOULD NOT contain SPACE"
    '"*:<>?' +  // not allowed in Windows
    "\\\\" +  // directory separator in Windows, regular character elsewhere
    "|" +  // not allowed in Windows
    "\\x00-\\x1F\\x7F-\\x9F" +  // control characters
    "\\uE000-\\uF8FF" +  // private use area
    "\\uFDD0-\\uFDEF" +  // non-characters
    "\\uFFF0-\\uFFFF" +  // specials

    // more non-characters: last two code points at the end of the
    // Supplementary Planes:
    "\\u{1FFFE}\\u{1FFFF}" +
    "\\u{2FFFE}\\u{2FFFF}" +
    "\\u{3FFFE}\\u{3FFFF}" +
    "\\u{4FFFE}\\u{4FFFF}" +
    "\\u{5FFFE}\\u{5FFFF}" +
    "\\u{6FFFE}\\u{6FFFF}" +
    "\\u{7FFFE}\\u{7FFFF}" +
    "\\u{8FFFE}\\u{8FFFF}" +
    "\\u{9FFFE}\\u{9FFFF}" +
    "\\u{AFFFE}\\u{AFFFF}" +
    "\\u{BFFFE}\\u{BFFFF}" +
    "\\u{CFFFE}\\u{CFFFF}" +
    "\\u{DFFFE}\\u{DFFFF}" +
    "\\u{EFFFE}\\u{EFFFF}" +

    "\\u{F0000}-\\u{FFFFF}" +  // Supplementary Private Use Area-A
    "\\u{100000}-\\u{10FFFF}" +  // Supplementary Private Use Area-B

    // other rules from specification handled below:
    // - \ changed to / by pathe.normalize
    // - weird directory separator use corrected by pathe.normalize
    // - "." as the last character converted separately
    "]",
    "gu");

  mangle(path: string) {
    path = path.toWellFormed();
    path = pathe.normalize(path);
    if (
      // path traversal attack
      path.startsWith("/") || path.startsWith("../") || path === ".." ||
      // path to directory
      path === "." || path.endsWith("/")
    ) {
      throw new InvalidPathError(path);
    }

    let base: string;
    let ext: string;
    const m = /^(.+?)(?:(\.[a-zA-Z0-9_-]+))?$/.exec(path);
    if (m) {
      base = m[1] as string;
      ext = (m[2] ?? "").toLowerCase();
    }
    else {
      base = path.replace(/\.$/, "_");  // . not allowed as last character
      ext = "";
    }

    const mangledBase = base.replace(
      FilenameMangler.forbiddenFilenameChars,
      "_");

    let maybeSuffixed = mangledBase;
    let i = 1;
    while (this.alreadySeen.has(maybeSuffixed)) {
      i++;
      maybeSuffixed = `${mangledBase}_${i}`;
    }
    this.alreadySeen.add(maybeSuffixed);

    const mangled = maybeSuffixed + ext;

    // check if path length within limits according to EPUB specs
    if (
      FilenameMangler.utf8Encoder.encode(mangled).length > 65535 ||
      mangled.split("/").some((part) =>
        FilenameMangler.utf8Encoder.encode(part).length > 255
      )
    ) {
      console.warn(
        "Warning: File path too long: %o. Compatibility problems possible.",
        mangled);
    }

    return mangled;
  }
}


export function removeCommonPathPrefix(paths: readonly string[]) {
  if (paths.length === 0)
    return paths;

  paths = paths.map(pathe.normalize);

  for (;;) {
    // get part until first "/", including "/"
    const firstPath = paths[0] as string;  // paths[0] exists, we checked
    const slashIdx = firstPath.indexOf("/");
    if (slashIdx < 0)  // if no "/", stop processing
      return paths;
    const part0 = firstPath.slice(0, slashIdx + 1);

    // if all paths don't start with the same part, stop processing
    if (!paths.slice(1).every((path) => path.startsWith(part0)))
      return paths;

    // delete the first path component, including "/"
    paths = paths.map((path) => path.slice(slashIdx + 1));
  }
}
