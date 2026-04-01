import * as mime from "mime-types";
import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { isCaptionFile } from "../captions.js";
import { isMimetypeSupported } from "../make-epub.js";


const enum Type {
  Directory,
  Image,
  Caption,
}


function isImage(filename: string): boolean {
  const mimetype = mime.lookup(filename);
  return !!mimetype && isMimetypeSupported(mimetype);
}

function chopExtension(path: string) {
  const ext = extname(path);
  if (ext === "") {
    return path;
  }
  else {
    return path.slice(0, -ext.length);
  }
}

export async function* findImages(
  paths: string[],
  locale?: string,
): AsyncGenerator<string> {
  // Natural sort collator. locale = undefined means use system locale.
  const collator = new Intl.Collator(locale, { numeric: true });

  async function* findRecursively(path: string): AsyncGenerator<string> {
    const dirEntries = await readdir(path, { withFileTypes: true });
    dirEntries.sort((a, b) => collator.compare(a.name, b.name));

    // Find relevant directory entries, mark their types, and build a
    // set of image names.
    const imageNames = new Set<string>();
    const filteredDirEntries = [];
    for (const dirEntry of dirEntries) {
      const fullPath = join(dirEntry.parentPath, dirEntry.name);

      // dirEntry.isFile() et al don't follow symlinks. We need to
      // follow them ourselves.
      const dirEntryInfo = dirEntry.isSymbolicLink()
        ? await stat(fullPath)
        : dirEntry;

      if (dirEntryInfo.isDirectory()) {
        filteredDirEntries.push({ type: Type.Directory, fullPath });
      }
      else if (dirEntryInfo.isFile()) {
        if (isImage(dirEntry.name)) {
          imageNames.add(chopExtension(fullPath));
          filteredDirEntries.push({ type: Type.Image, fullPath });
        }
        else if (isCaptionFile(dirEntry.name)) {
          filteredDirEntries.push({ type: Type.Caption, fullPath });
        }
      }
    }

    // Yield images and captions
    for (const { type, fullPath } of filteredDirEntries) {
      switch (type) {
        case Type.Directory:
          yield* findRecursively(fullPath);
          break;

        case Type.Image:
          yield fullPath;
          break;

        case Type.Caption:
          // yield caption file only if it doesn't belong to an image
          if (!imageNames.has(chopExtension(fullPath))) {
            yield fullPath;
          }
          break;
      }
    }
  }

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
