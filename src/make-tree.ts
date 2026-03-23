export type Tree<T> = T | readonly [T, readonly Tree<T>[]];

function* makeTreeGen<T>(paths: readonly (readonly T[])[]): Generator<Tree<T>> {
  let group: [T, (readonly T[])[]] | null = null;

  function* maybeYieldGroup(): Generator<Tree<T>> {
    if (group != null) {
      yield [group[0], makeTree(group[1])];
    }
  }

  for (const [first, ...rest] of paths) {
    if (first != null) {
      if (rest.length === 0) {
        yield* maybeYieldGroup();
        yield first;
        group = null;
      }
      else if (group != null && first === group[0]) {
        group[1].push(rest);
      }
      else {
        yield* maybeYieldGroup();
        group = [first, [rest]];
      }
    }
  }

  yield* maybeYieldGroup();
}

export const makeTree = <T>(paths: readonly (readonly T[])[]) =>
  makeTreeGen(paths).toArray();
