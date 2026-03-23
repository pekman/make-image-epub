type Input<T> = T & { readonly path: readonly string[] };
type FileOrFolder<T> = T & { readonly name: string };

export type Tree<T> =
  FileOrFolder<T> |
  readonly [FileOrFolder<T>, readonly Tree<T>[]];


function* makeTreeGen<T>(paths: readonly Input<T>[]): Generator<Tree<T>> {
  let group: [string, Input<T>[]] | null = null;

  function* maybeYieldGroup(): Generator<Tree<T>> {
    if (group != null) {
      const [name, subtree] = group;
      const { path, ...data } = subtree[0]!;
      yield [{ name, ...(data as T) }, makeTree(subtree)];
    }
  }

  for (const { path: [first, ...rest], ...other } of paths) {
    const data = other as T;
    if (first != null) {
      if (rest.length === 0) {
        yield* maybeYieldGroup();
        yield { name: first, ...data };
        group = null;
      }
      else if (group != null && first === group[0]) {
        group[1].push({ path: rest, ...data });
      }
      else {
        yield* maybeYieldGroup();
        group = [first, [{ path: rest, ...data }]];
      }
    }
  }

  yield* maybeYieldGroup();
}

export const makeTree = <T>(paths: readonly Input<T>[]) =>
  makeTreeGen(paths).toArray();
