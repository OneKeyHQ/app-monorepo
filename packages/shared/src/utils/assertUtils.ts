import assert from 'assert';

type ErrorType = undefined | string | Error;

const check = (statement: any, orError?: ErrorType) => {
  if (!statement) {
    // eslint-disable-next-line no-param-reassign
    orError = orError || 'Invalid statement';
    // eslint-disable-next-line no-param-reassign
    orError = orError instanceof Error ? orError : new Error(orError);

    throw orError;
  }
};
const checkIsDefined = <T>(something?: T, orError?: ErrorType): T => {
  check(
    typeof something !== 'undefined',
    orError || 'Expect defined but actually undefined',
  );
  return something as T;
};

const checkIsUndefined = (something: any, orError?: ErrorType) => {
  check(
    typeof something === 'undefined',
    orError || `Expect undefined but actually ${something as string}`,
  );
};

export { assert, check, checkIsDefined, checkIsUndefined };
