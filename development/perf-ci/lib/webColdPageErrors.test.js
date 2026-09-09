const {
  classifyPageErrors,
  isNetworkRequestPageError,
} = require('./webColdPageErrors');

describe('web cold page error classification', () => {
  test('treats Axios request failures as non-blocking diagnostics', () => {
    const error = {
      name: 'AxiosError',
      message: 'Please retry.',
      stack:
        'AxiosError: Please retry.\n    at async Axios.request (vendor.js:1:2)',
    };

    expect(isNetworkRequestPageError(error)).toBe(true);
    expect(classifyPageErrors([error])).toEqual({
      blocking: [],
      ignoredNetwork: [error],
    });
  });

  test('keeps errors mentioning Axios.request only in the message blocking', () => {
    const error = {
      name: 'AxiosError',
      message: 'Failed to initialize Axios.request handler.',
      stack:
        'AxiosError: Failed to initialize Axios.request handler.\n    at initializeApp (main.js:1:2)',
    };

    expect(isNetworkRequestPageError(error)).toBe(false);
    expect(classifyPageErrors([error])).toEqual({
      blocking: [error],
      ignoredNetwork: [],
    });
  });

  test('keeps application errors from Axios interceptors blocking', () => {
    const error = {
      name: 'OneKeyError',
      message: 'Unexpected API response.',
      stack:
        'OneKeyError: Unexpected API response.\n    at responseInterceptor (main.js:1:2)\n    at async Axios.request (vendor.js:1:2)',
    };

    expect(isNetworkRequestPageError(error)).toBe(false);
    expect(classifyPageErrors([error])).toEqual({
      blocking: [error],
      ignoredNetwork: [],
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
