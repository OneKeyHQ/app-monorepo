const createAvatar = require('ethereum-blockies-base64');

const caches = {};

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
