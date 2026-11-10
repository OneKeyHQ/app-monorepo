import { isPrimeUserBannedError } from './primeUserBanned';

describe('Prime account restrictions', () => {
  test.each([
    { code: 90_012 },
    { data: { code: '90012' } },
    { response: { data: { code: 90_012 } } },
  ])('recognizes the ban code in serialized server errors: %j', (error) =>
    expect(isPrimeUserBannedError(error)).toBe(true),
  );

  test.each([
    null,
    undefined,
    {},
    { code: 90_300 },
    { data: { code: 90_002 } },
  ])('keeps other errors unchanged: %j', (error) =>
    expect(isPrimeUserBannedError(error)).toBe(false),
  );
});
