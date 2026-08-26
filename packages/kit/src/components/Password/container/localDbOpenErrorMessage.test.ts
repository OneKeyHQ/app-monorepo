import { formatLocalDbOpenErrorMessage } from './localDbOpenErrorMessage';

const DOWNGRADE_GUIDANCE_MESSAGE =
  'Database read error. Please make sure you are using the latest version of the app.';

describe('formatLocalDbOpenErrorMessage', () => {
  it.each([
    'The requested version (19) is less than the existing version (20).',
    'The requested version (7) is less than the existing version (42).',
    'Provided schema version 19 is less than last set version 20.',
    'Provided schema version 7 is less than last set version 42.',
  ])('appends update guidance to a database downgrade error: %s', (message) => {
    expect(
      formatLocalDbOpenErrorMessage(message, DOWNGRADE_GUIDANCE_MESSAGE),
    ).toBe(`${message}\n${DOWNGRADE_GUIDANCE_MESSAGE}`);
  });

  it.each([
    'DB open unknown error',
    'The requested version (20) is equal to the existing version (20).',
    'Provided schema version 20 is greater than last set version 19.',
    'The requested version (20) is less than the existing version (20).',
    'The requested version (20) is less than the existing version (19).',
    'Provided schema version 20 is less than last set version 20.',
    'Provided schema version 20 is less than last set version 19.',
  ])('preserves other database errors: %s', (message) => {
    expect(
      formatLocalDbOpenErrorMessage(message, DOWNGRADE_GUIDANCE_MESSAGE),
    ).toBe(message);
  });
});
