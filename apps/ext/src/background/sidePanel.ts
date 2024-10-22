import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';

const SIDE_PANEL_PORT_NAME = 'ONEKEY_SIDE_PANEL';
export const setupSidePanelPortInBg = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === SIDE_PANEL_PORT_NAME) {
      // reset side panel default path after 6 seconds
      //  to avoid the side panel being stuck in a modal on every time it opens.

      setTimeout(async () => {
        await extUtils.resetSidePanelPath();
      }, 6000);

      sidePanelState.isOpen = true;

      let dappRejectId: string | number | undefined;
      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
        const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
        if (dappRejectId) {
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
  const port = chrome.runtime.connect({ name: SIDE_PANEL_PORT_NAME });
  port.onMessage.addListener(
    ({
      type,
      payload,
    }: IAppEventBusPayload[EAppEventBusNames.SidePanel_BgToUI]) => {
      switch (type) {
        case 'pushModal':
          {
            const { screen, params } = payload.modalParams;
            globalThis.$navigationRef.current?.navigate(screen, params);
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
