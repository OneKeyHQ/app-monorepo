const groupBy = <K extends keyof any, T>(
  array: Array<T>,
  key: (i: T) => K,
): Record<K, Array<T>> =>
  array.reduce((acc, cur: T) => {
    const group = key(cur);
    if (!acc[group]) {
      acc[group] = [];
    }

    acc[group].push(cur);
    return acc;
  }, {} as Record<K, Array<T>>);

const chunked = <T>(array: Array<T>, size: number): Array<Array<T>> => {
  const chunks = [];

  for (let i = 0, count = array.length; i < count; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
};

export { groupBy, chunked };
