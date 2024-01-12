const createAvatar = require('ethereum-blockies-base64');

onmessage = (event) => {
  postMessage(event.data.map((id) => createAvatar(id)));
};
