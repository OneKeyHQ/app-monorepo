function isNetworkRequestPageError(error) {
  if (error?.name !== 'AxiosError') {
    return false;
  }

  const stack = typeof error?.stack === 'string' ? error.stack : '';
  const stackFrames = stack.split('\n').slice(1);
  return stackFrames.some((line) =>
    /^\s*at\s+(?:async\s+)?Axios\.request\b/.test(line),
  );
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
