const BTN_ID = 'onekey-inpage-debug-dev-tools-button';
const BTN_TEXT = 'RELOAD';
const IFRAME_ID = 'onekey-inpage-debug-dev-tools-iframe';
const IFRAME_URL = chrome.runtime.getURL('ui-content-script-iframe.html');

// iframe is a HACK for background service-worker updating.
function injectIframe() {
  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = `
    border: 0px solid red;
    height: 0;
    width: 0;
    position: absolute;
    z-index: -999999;
  `;
  document.body.appendChild(iframe);
  return iframe;
}

function injectDevToolsButton() {
  if (!document.body) {
    return;
  }
  if (document.getElementById(BTN_ID)) {
    return;
  }
  const iframe = injectIframe();

  const devToolsButton = document.createElement('button');
  devToolsButton.title =
    'Reload OneKey extension and this site, make injected.js updated.';
  devToolsButton.draggable = true;
  devToolsButton.innerHTML = BTN_TEXT;
  devToolsButton.id = BTN_ID;
  // eslint-disable-next-line spellcheck/spell-checker
  devToolsButton.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99999;
    border: 1px solid #eee;
    font-size: 12px;
    background: rgb(0, 170, 17);
    color: white;
    padding: 0 4px;
    border-radius: 8px;
    outline: none;
  `;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  devToolsButton.addEventListener('dragstart', (event) => {
    const { pageX, pageY } = event;
    startX = pageX;
    startY = pageY;
    startLeft = devToolsButton.offsetLeft;
    startTop = devToolsButton.offsetTop;
  });
  // dragover dragend
  devToolsButton.addEventListener('dragend', (event) => {
    event.preventDefault();
    const { pageX, pageY } = event;
    devToolsButton.style.left = `${startLeft + (pageX - startX)}px`;
    devToolsButton.style.top = `${startTop + (pageY - startY)}px`;
  });
  devToolsButton.addEventListener('click', () => {
    try {
      console.log('chrome.runtime', chrome.runtime);
      console.log('========================================');
      console.log('>>>>>>>> OneKey Extension reloading in 3s...');
      console.log(`>>>>>>>> ${IFRAME_URL}`);
      console.log('========================================');

      setTimeout(() => {
        iframe.src = IFRAME_URL;
        setTimeout(() => {
          globalThis.location.reload();
        }, 500);
      }, 1000);

      void chrome.runtime.sendMessage({
        channel: 'EXTENSION_INTERNAL_CHANNEL',
        method: 'reload',
      });
    } catch (err) {
      console.error(err);
    }
  });
  document.body.appendChild(devToolsButton);
}

function inject() {
  // setTimeout delay required
  setTimeout(() => {
    globalThis.addEventListener('DOMContentLoaded', () => {
      injectDevToolsButton();
    });
    injectDevToolsButton();
  }, 2000);
}

export default {
  inject,
};
