/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

type IKeepAlivePayloadMessage = { keepAlive?: boolean; origin?: string };
type IKeepAliveFeedbackMessage = { rogerThat: boolean; time: string };

// create the offscreen document if it doesn't already exist
async function createOffscreen() {
  // @ts-ignore
  if (await chrome.offscreen.hasDocument?.()) {
    return;
  }

  // @ts-ignore
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'] as chrome.offscreen.Reason[],
    justification: 'keep background service worker running and alive',
  });
}

// run in background
export function setupKeepAlive() {
  void createOffscreen();
  setTimeout(() => {
    void createOffscreen();
  }, 1000);
  chrome.runtime.onStartup.addListener(() => {
    void createOffscreen();
  });
  // a message from an offscreen document every 20 second resets the inactivity timer
  chrome.runtime.onMessage.addListener(
    (
      msg: IKeepAlivePayloadMessage | undefined,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (msg?.keepAlive) {
        const time = new Date().toLocaleString();
        console.log('keepAlive:  ', msg?.origin, time);
        sendResponse({ rogerThat: true, time } as IKeepAliveFeedbackMessage);
      }
    },
  );
}

// run in offscreen or content-script
export function startKeepAlivePolling() {
  const reconnectToBg = () => {
    // do nothing yet, reconnect by offscreenBridge?.portToBg checking
    // chrome.runtime.sendMessage function do not required port to be established
  };
  const doPolling = async () => {
    const msg: IKeepAlivePayloadMessage | undefined = {
      keepAlive: true,
      origin: window?.location?.origin,
    };
    try {
      // @ts-ignore
      const res: IKeepAliveFeedbackMessage | undefined =
        // eslint-disable-next-line @typescript-eslint/await-thenable
        await chrome.runtime.sendMessage(msg);
      if (res?.rogerThat) {
        console.log('keepAlive feedback:  ', res);
      } else {
        reconnectToBg();
      }
    } catch (error) {
      console.error(error);
      reconnectToBg();
    }
  };
  void doPolling();
  setInterval(() => {
    void doPolling();
  }, 20000);
}
