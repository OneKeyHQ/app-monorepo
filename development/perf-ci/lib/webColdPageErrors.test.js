const {
  classifyPageErrors,
  isNetworkRequestPageError,
} = require('./webColdPageErrors');

describe('web cold page error classification', () => {
  test('treats Axios request failures as non-blocking diagnostics', () => {
    const error = {
      name: 'OneKeyError',
      message: 'Please retry.',
      stack:
        'OneKeyError: Please retry.\n    at async Axios.request (vendor.js:1:2)',
    };

    expect(isNetworkRequestPageError(error)).toBe(true);
    expect(classifyPageErrors([error])).toEqual({
      blocking: [],
      ignoredNetwork: [error],
    });
  });

  test('keeps non-network runtime errors blocking', () => {
    const error = {
      name: 'OneKeyError',
      message: 'Unexpected state.',
      stack: 'OneKeyError: Unexpected state.\n    at renderApp (main.js:1:2)',
    };

    expect(isNetworkRequestPageError(error)).toBe(false);
    expect(classifyPageErrors([error])).toEqual({
      blocking: [error],
      ignoredNetwork: [],
    });
  });
});
