import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const PORT_NAME = 'ONEKEY_SIDE_PANEL';
export const setupSidePanelPolling = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === PORT_NAME) {
      let timerId: ReturnType<typeof setTimeout>;
      sidePanelState.isOpen = true;
      sidePanelState.port = port;

      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
        sidePanelState.port = undefined;
      };

      port.onMessage.addListener(() => {
        clearTimeout(timerId);
        timerId = setTimeout(() => {
          port.disconnect();
          closeSidePanel();
        }, timerUtils.getTimeDurationMs({ seconds: 5 }));
      });
      port.onDisconnect.addListener(() => {
        closeSidePanel();
      });
    }
  });
};

export const startSidePanelPolling = () => {
  const port = chrome.runtime.connect({ name: PORT_NAME });
  setInterval(() => {
    port.postMessage('ping');
  }, timerUtils.getTimeDurationMs({ seconds: 3 }));
  port.onMessage.addListener(
    (event: { action: 'router'; params: Record<string, any> }) => {
      switch (event.action) {
        case 'router':
          {
            const { screen, params } = event.params as {
              screen: any;
              params: any;
            };
            global.$navigationRef.current?.navigate(screen, params);
          }
          break;
        default:
          break;
      }
    },
  );
};
