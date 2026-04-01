import { fs as memfs } from "memfs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it, vi } from "vitest";

import { findImages } from "../../src/cli/find-images.js";


vi.mock("node:fs", () => memfs);
vi.mock("node:fs/promises", () => memfs.promises);


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
])("should find only images in right order, locale=%j", async (locale) => {
  for (const filename of TEST_FILES) {
    const dir = path.dirname(filename);
    if (dir !== ".") {
      await mkdir(path.join("/", dir), { recursive: true });
    }
    await writeFile(path.join("/", filename), "");
  }

  const images = await Array.fromAsync(findImages(["/"], locale));
  const imagesRelative = images.map((img) => path.relative("/", img));

  expect(imagesRelative).toEqual(IMAGE_FILES_SORTED);
});

it("should find text-only pages", async () => {
  const testFiles = [
    "file0.txt",
    ...TEST_FILES,
  ];
  const expectedResult = [
    "file0.txt",
    ...IMAGE_FILES_SORTED,
  ];

  for (const filename of testFiles) {
    const dir = path.dirname(filename);
    if (dir !== ".") {
      await mkdir(path.join("/", dir), { recursive: true });
    }
    await writeFile(path.join("/", filename), "");
  }

  const images = await Array.fromAsync(findImages(["/"]));
  const imagesRelative = images.map((img) => path.relative("/", img));

  expect(imagesRelative).toEqual(expectedResult);
});

it("should detect when a text file belongs to an image", async () => {
  const { writeFile } = memfs.promises;
  await writeFile("/page1.txt", "text-only page");
  await writeFile("/page2.txt", "image caption");
  await writeFile("/page2.jpg", "(image data)");
  await writeFile("/page3.jpg", "(image data)");

  const images = await Array.fromAsync(findImages(["/"]));
  expect(images).toContain("/page1.txt");
  expect(images).toContain("/page2.jpg");
  expect(images).not.toContain("/page2.txt");
  expect(images).toContain("/page3.jpg");
});
