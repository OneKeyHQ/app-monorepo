import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';

const PORT_NAME = 'ONEKEY_SIDE_PANEL';
export const setupSidePanelPortInBg = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === PORT_NAME) {
      sidePanelState.isOpen = true;

      let rejectId: string | number | undefined;
      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
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

      appEventBus.on(
        EAppEventBusNames.SidePanel_BG2UI_PushModal,
        (params: any) => {
          port.postMessage({
            type: 'router',
            params: {
              screen: 'Modal',
              params,
            },
          });
        },
      );
    }
  });
};

export const setupSidePanelPortInUI = () => {
  const port = chrome.runtime.connect({ name: PORT_NAME });
  port.onMessage.addListener(
    (event: { type: 'router'; params: Record<string, any> }) => {
      switch (event.type) {
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

  appEventBus.on(EAppEventBusNames.SidePanel_UI2Bg_DappRejectId, (rejectId) => {
    port.postMessage({
      type: 'rejectId',
      payload: rejectId,
    });
  });
};
