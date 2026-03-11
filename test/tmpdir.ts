import { mkdtempDisposable } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test as baseTest } from "vitest";

export const test = baseTest.extend<{
  tmpdir: string,
}>({
  tmpdir: async ({}, use) => {
    await using tmpdir = await mkdtempDisposable(
      path.join(os.tmpdir(), "make-image-epub-test-"),
    );
    await use(tmpdir.path);
  },
});

export const it = test;
