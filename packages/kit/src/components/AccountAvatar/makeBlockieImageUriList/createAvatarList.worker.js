const createAvatar = require('ethereum-blockies-base64');

const caches = {};

// TODO: here is a better idea.
//  Intercept network requests and generate avatar in web worker.
//   In this way, you can use the browser's cache system to cache Avatar images, avoiding manual maintenance of memory cache.
//   https://gist.github.com/dsheiko/8a5878678371f950d37f3ee074fe8031

onmessage = (event) => {
  const id = event.data;

  let result = caches[id];
  if (!result) {
    result = {
      id,
      data: createAvatar(id),
    };
    caches[id] = result;
  }
  postMessage(result);
};
