const createDelayPromise = <T>(
  delay: number,
  value?: T,
): Promise<T | undefined> =>
  new Promise((resolve) => setTimeout(() => resolve(value), delay));

const createAnyPromise = <T>(promises: Promise<T>[]): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  Promise.all(
    promises.map((p) =>
      p.then(
        (val) => Promise.reject(val),
        (err) => Promise.resolve(err),
      ),
    ),
  ).then(
    (errors) => Promise.reject(errors),
    (val) => Promise.resolve(val),
  );

export { createDelayPromise, createAnyPromise };
