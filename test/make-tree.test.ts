import { expect, test } from "vitest";
import { makeTree } from "../src/make-tree.js";

const FLAT = [
  "1/leaf1",
  "1/2/leaf2",
  "1/2/leaf3",
  "leaf4",
  "3/leaf5",
].map((item) => item.split("/"));

const TREE = [
  ["1", [
    "leaf1",
    ["2", [
      "leaf2",
      "leaf3",
    ]],
  ]],
  "leaf4",
  ["3", [
    "leaf5",
  ]],
];


test("tree construction", () => {
  const tree = makeTree(FLAT);
  expect(tree).toEqual(TREE);
});
