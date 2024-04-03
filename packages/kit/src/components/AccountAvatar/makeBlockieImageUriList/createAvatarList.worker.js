const createAvatar = require('ethereum-blockies-base64');

const caches = {};

// TODO: here is a better idea.
//  Intercept network requests and generate avatar in web worker.
//   In this way, you can use the browser's cache system to cache Avatar images, avoiding manual maintenance of memory cache.

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
