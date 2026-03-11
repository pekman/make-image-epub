import { assert, describe, expect, it } from "vitest";
import {
  FilenameMangler,
  InvalidPathError,
  removeCommonPathPrefix,
} from "../src/filenames.js";


describe("filename mangling for EPUB", () => {
  it("should not create directory traversal attacks", () => {
    const badPaths = [
      "../a",
      "/a/b",
      "a/b/../../../c",
    ];
    const m = new FilenameMangler();
    for (const badPath of badPaths) {
      expect(() => m.mangle(badPath)).toThrow(InvalidPathError);
    }
  });

  it('should convert characters not allowed in EPUB to "_"', () => {
    const result = new FilenameMangler().mangle("aa bb/cc\uE123dd");
    expect(result).toBe("aa_bb/cc_dd");
  });

  it("should not create name collisions on case-insensitive platform", () => {
    const inputPaths = [
      "FileName",
      "filename",
      "Unicode-Normalisierung_macht_viel_Spaß",
      "Unicode-Normalisierung_macht_viel_Spass",
      "Unicode-Normalisierung_macht_VIEL_SPASS",
      "FILENAME",
    ];
    const m = new FilenameMangler();
    const result = inputPaths.map((path) => m.mangle(path));
    expect(result[0]).toBe(inputPaths[0]);
    expect(result[1]).toBe(inputPaths[1] + "_2");
    expect(result[2]).toBe(inputPaths[2]);
    expect(result[3]).toBe(inputPaths[3] + "_2");
    expect(result[4]).toBe(inputPaths[4] + "_3");
    expect(result[5]).toBe(inputPaths[5] + "_3");
  });

  it("should handle name collisions from mangling", () => {
    const inputPaths = [
      "aa bb",
      "aa_bb",
    ];
    const m = new FilenameMangler();
    const result = inputPaths.map((path) => m.mangle(path));
    expect(result).toEqual(["aa_bb", "aa_bb_2"]);
  });
});


describe("common path prefix removal", () => {
  function removePrefix(prefix: string, paths: readonly string[]) {
    assert(paths.every((path) => path.startsWith(prefix)));
    return paths.map((path) => path.slice(prefix.length));
  };

  it("should remove common path prefix", () => {
    const paths = [
      "a/b/c/d",
      "a/b/e",
      "a/b/c/f",
    ];
    const result = removeCommonPathPrefix(paths);
    expect(result).toEqual(removePrefix("a/b/", paths));
  });

  it("should not touch filename part of the path", () => {
    const paths = [
      "a/b/c/d",
      "a/b/c",
    ];
    const result = removeCommonPathPrefix(paths);
    expect(result).toEqual(removePrefix("a/b/", paths));
  });

  it("should only cut at slash", () => {
    const paths = [
      "a/b-c/d",
      "a/b-e/f",
    ];
    const result = removeCommonPathPrefix(paths);
    expect(result).toEqual(removePrefix("a/", paths));
  });

  it("should handle non-normalized paths", () => {
    const paths = [
      "a/b/c/1",
      "a/b//c/2",
      "a/b///c/3",
      "a/b/./c/4",
      "a/b/x/../c/5",
      "./a/b/c/6",
    ];
    const result = removeCommonPathPrefix(paths);
    expect(result).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
