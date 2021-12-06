import '../pages/index';

const port = chrome.runtime.connect({ name: 'knockknock-ui' });
port.postMessage({ joke: 'Knock knock' });
port.onMessage.addListener((msg) => {
  console.log('msg from background', msg);
  if (msg.question === "Who's there?") {
    port.postMessage({ answer: 'Madame' });
  } else if (msg.question === 'Madame who?') {
    port.postMessage({ answer: 'Madame... Bovary' });
  }
});
window.portUiToBg = port;
// unload disconnect
