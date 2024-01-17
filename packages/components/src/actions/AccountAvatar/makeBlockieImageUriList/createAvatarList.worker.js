const createAvatar = require('ethereum-blockies-base64');

onmessage = (event) => {
  postMessage(createAvatar(event.data));
};
