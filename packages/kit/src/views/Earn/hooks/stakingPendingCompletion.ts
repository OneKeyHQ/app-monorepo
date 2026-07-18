export interface IPendingCompletionRefreshOwner {
  begin: () => number;
  invalidate: () => void;
  isCurrent: (attempt: number) => boolean;
}

export function createPendingCompletionRefreshOwner(): IPendingCompletionRefreshOwner {
  let generation = 0;

  return {
    begin: () => {
      generation += 1;
      return generation;
    },
    invalidate: () => {
      generation += 1;
    },
    isCurrent: (attempt) => attempt === generation,
  };
}
