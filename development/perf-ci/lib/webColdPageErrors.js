function isNetworkRequestPageError(error) {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  return /\bAxios\.request\b/.test(stack);
}

function classifyPageErrors(pageErrors) {
  const blocking = [];
  const ignoredNetwork = [];

  for (const error of pageErrors) {
    if (isNetworkRequestPageError(error)) {
      ignoredNetwork.push(error);
    } else {
      blocking.push(error);
    }
  }

  return { blocking, ignoredNetwork };
}

module.exports = {
  classifyPageErrors,
  isNetworkRequestPageError,
};
