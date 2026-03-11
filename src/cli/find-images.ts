import * as mime from "mime-types";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";


function isImage(filename: string): boolean {
  const mimetype = mime.lookup(filename);
  return !!mimetype && mimetype.startsWith("image/");
}

/** Natural sort collator for current locale */
const collator = new Intl.Collator(undefined, { numeric: true });

async function* findRecursively(path: string): AsyncGenerator<string> {
  const dirEntries = await readdir(path, { withFileTypes: true });
  dirEntries.sort((a, b) => collator.compare(a.name, b.name));

  for (const dirEntry of dirEntries) {
    const dirEntryPath = join(dirEntry.parentPath, dirEntry.name);

    // dirEntry.isFile() et al don't follow symlinks. We need to
    // follow them ourselves.
    const dirEntryInfo = dirEntry.isSymbolicLink()
      ? await stat(dirEntryPath)
      : dirEntry;

    if (dirEntryInfo.isDirectory()) {
      yield* findRecursively(dirEntryPath);
    }
    else if (dirEntryInfo.isFile() && isImage(dirEntry.name)) {
      yield dirEntryPath;
    }
  }
}

export async function* findImages(paths: string[]): AsyncGenerator<string> {
  for (const path of paths) {
    const s = await stat(path);
    if (s.isDirectory()) {
      yield* findRecursively(path);
    }
    else if (s.isFile() && isImage(path)) {
      yield path;
    }
  }
}
