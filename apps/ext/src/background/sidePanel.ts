import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const PORT_NAME = 'ONEKEY_SIDE_PANEL';
export const setupSidePanelPolling = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === PORT_NAME) {
      let timerId: ReturnType<typeof setTimeout>;
      sidePanelState.isOpen = true;
      sidePanelState.port = port;

      let rejectId: string | number | undefined;
      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
        sidePanelState.port = undefined;
        if (rejectId) {
          const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
          void backgroundApiProxy.servicePromise.rejectCallback({
            id: rejectId,
            error: new Error(
              'Dapp authorization rejected due to SidePanel closure.',
            ),
          });
        }
      };

      port.onMessage.addListener(
        (event: {
          type: 'rejectId';
          payload: {
            rejectId: string;
          };
        }) => {
          clearTimeout(timerId);
          timerId = setTimeout(() => {
            port.disconnect();
            closeSidePanel();
          }, timerUtils.getTimeDurationMs({ seconds: 5 }));
          switch (event?.type) {
            case 'rejectId': {
              rejectId = event.payload.rejectId;
              break;
            }
            default:
              break;
          }
        },
      );
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
  return port;
};
