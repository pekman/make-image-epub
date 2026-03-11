import { expect, it } from "vitest";
import { DUBLIN_CORE_METADATA_KEYS } from "../src/epub-parameters.js";


const converter = DUBLIN_CORE_METADATA_KEYS.date.converter;

it("should do simple format conversions", () => {
  expect(converter("  2000-01-01  12:34 z  ")).toBe("2000-01-01T12:34Z");
});

it("should reject invalid value", () => {
  expect(() => converter("not a date")).toThrowError();
});

it("should accept different levels of precision", () => {
  const parts = ["1234", "-01", "-01", "T12:34", ":56", ".78", "+02:00"];

  for (let i = 1; i < parts.length; i++) {
    const datestr = parts.slice(0, i).join("");
    expect(
      () => converter(datestr),
      `not accepted: ${JSON.stringify(datestr)}`,
    ).not.toThrowError();
  }
});
