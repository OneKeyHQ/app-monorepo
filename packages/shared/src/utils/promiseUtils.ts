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

function createPromiseWithTimeout<T>(
  promise: Promise<T>,
  timeout: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Operation timed out'));
    }, timeout);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export { createDelayPromise, createAnyPromise, createPromiseWithTimeout };
