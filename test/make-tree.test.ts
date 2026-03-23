import { expect, test } from "vitest";
import { makeTree } from "../src/make-tree.js";

const FLAT = [
  "1/leaf1",
  "1/2/leaf2",
  "1/2/leaf3",
  "leaf4",
  "3/leaf5",
].map((item, i) => ({ path: item.split("/"), data: i + 1 }));

const TREE = [
  [{ name: "1", data: 1 }, [
    { name: "leaf1", data: 1 },
    [{ name: "2", data: 2 }, [
      { name: "leaf2", data: 2 },
      { name: "leaf3", data: 3 },
    ]],
  ]],
  { name: "leaf4", data: 4 },
  [{ name: "3", data: 5 }, [
    { name: "leaf5", data: 5 },
  ]],
];


test("tree construction", () => {
  const tree = makeTree(FLAT);
  expect(tree).toEqual(TREE);
});
