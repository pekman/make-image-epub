import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import { findImages } from "../../src/cli/find-images.js";
import { it } from "../tmpdir.js";


const TEST_FILES = [
  "file1.jpg",
  "z-last-file.jpg",
  "file2.JPG",
  "file3.png",
  "file4.exe",
  "file10.jpg",
  "subdir/subdir2/subdir3/file.webp",
  "subdir/a-subdir-file.png",
] as const;

const IMAGE_FILES_SORTED = [
  "file1.jpg",
  "file2.JPG",
  "file3.png",
  "file10.jpg",
  "subdir/a-subdir-file.png",
  "subdir/subdir2/subdir3/file.webp",
  "z-last-file.jpg",
] as const;

it.for([
  "en", "fi", "vi",
])(
  "should find only images in right order, locale=%j",
  async (locale, { tmpdir }) => {
    for (const filename of TEST_FILES) {
      const dir = path.dirname(filename);
      if (dir !== ".") {
        await mkdir(path.join(tmpdir, dir), { recursive: true });
      }
      await writeFile(path.join(tmpdir, filename), "");
    }

    const images = await Array.fromAsync(findImages([tmpdir], locale));
    const imagesRelative = images.map((img) => path.relative(tmpdir, img));

    expect(imagesRelative).toEqual(IMAGE_FILES_SORTED);
  }
);
