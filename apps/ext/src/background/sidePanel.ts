import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
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

      let dappRejectId: string | number | undefined;
      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
        if (dappRejectId) {
          const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
          void backgroundApiProxy.servicePromise.rejectCallback({
            id: dappRejectId,
            error: new Error(
              'Dapp authorization rejected due to SidePanel closure.',
            ),
          });
        }
      };

      port.onMessage.addListener(
        ({
          type,
          payload,
        }: IAppEventBusPayload[EAppEventBusNames.SidePanel_UIToBg]) => {
          switch (type) {
            case 'dappRejectId': {
              dappRejectId = payload.rejectId;
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

      appEventBus.on(EAppEventBusNames.SidePanel_BgToUI, (params) => {
        port.postMessage(params);
      });
    }
  });
};

export const setupSidePanelPortInUI = () => {
  const port = chrome.runtime.connect({ name: PORT_NAME });
  port.onMessage.addListener(
    ({
      type,
      payload,
    }: IAppEventBusPayload[EAppEventBusNames.SidePanel_BgToUI]) => {
      switch (type) {
        case 'pushModal':
          {
            const { screen, params } = payload.modalParams;
            global.$navigationRef.current?.navigate(screen, params);
          }
          break;
        default:
          break;
      }
    },
  );

  appEventBus.on(EAppEventBusNames.SidePanel_UIToBg, (params) => {
    port.postMessage(params);
  });
};
