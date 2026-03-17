import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  isKeylessWebAutoConnectOriginAllowed,
  isKeylessWebOpenSidePanelMessage,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebUtils';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';

const SIDE_PANEL_PORT_NAME = 'ONEKEY_SIDE_PANEL';

let pendingKeylessProviderForOpenSidePanel:
  | EOAuthSocialLoginProvider
  | undefined;

type IBackgroundApiProxy =
  typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;

function getBackgroundApiProxy(): IBackgroundApiProxy {
  const backgroundApiProxyModule =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as {
      default: IBackgroundApiProxy;
    };
  return backgroundApiProxyModule.default;
}

function pushKeylessLoginModalToSidePanel(provider: EOAuthSocialLoginProvider) {
  appEventBus.emit(EAppEventBusNames.SidePanel_BgToUI, {
    type: 'pushModal',
    payload: {
      modalParams: {
        screen: EModalRoutes.OnboardingModal,
        params: {
          screen: EOnboardingPagesV2.OneKeyIDLogin,
          params: {
            mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            provider,
          },
        },
      },
    },
  });
}

async function openKeylessSidePanelByUserGesture({
  sender,
  provider,
}: {
  sender: chrome.runtime.MessageSender;
  provider?: EOAuthSocialLoginProvider;
}) {
  if (!chrome.sidePanel?.open) {
    throw new OneKeyLocalError('side panel api is unavailable');
  }
  if (!provider) {
    throw new OneKeyLocalError('provider is required');
  }
  if (!isKeylessWebAutoConnectOriginAllowed(sender.url)) {
    throw new OneKeyLocalError('origin is not allowed for keyless side panel');
  }

  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') {
    throw new OneKeyLocalError('sender tab info is invalid');
  }

  if (sidePanelState.isOpen) {
    pushKeylessLoginModalToSidePanel(provider);
    return {
      success: true,
      tabId,
      windowId,
      alreadyOpen: true,
    };
  }

  pendingKeylessProviderForOpenSidePanel = provider;
  try {
    const sidePanelPath = chrome.runtime.getURL('/ui-side-panel.html');
    await chrome.sidePanel.setOptions({
      tabId,
      path: sidePanelPath,
      enabled: true,
    });
    await chrome.sidePanel.open({
      windowId,
    });
  } catch (error) {
    pendingKeylessProviderForOpenSidePanel = undefined;
    throw error;
  }
  return {
    success: true,
    tabId,
    windowId,
    alreadyOpen: false,
  };
}

async function tryImmediateOpenSidePanelOnMessage({
  sender,
  provider,
}: {
  sender: chrome.runtime.MessageSender;
  provider?: EOAuthSocialLoginProvider;
}): Promise<
  | {
      success: true;
      tabId: number;
      windowId: number;
      alreadyOpen: boolean;
    }
  | undefined
> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  if (
    !chrome.sidePanel?.open ||
    typeof tabId !== 'number' ||
    typeof windowId !== 'number' ||
    !provider
  ) {
    return undefined;
  }

  if (!isKeylessWebAutoConnectOriginAllowed(sender.url)) {
    return undefined;
  }

  pendingKeylessProviderForOpenSidePanel = provider;

  const attemptList: Array<
    | { mode: 'windowId'; payload: { windowId: number } }
    | { mode: 'tabId'; payload: { tabId: number } }
  > = [
    {
      mode: 'windowId',
      payload: { windowId },
    },
    {
      mode: 'tabId',
      payload: { tabId },
    },
  ];

  for (const attempt of attemptList) {
    try {
      await chrome.sidePanel.open(attempt.payload);

      // Keep tab-specific path stable after immediate open.
      void chrome.sidePanel
        .setOptions({
          tabId,
          path: chrome.runtime.getURL('/ui-side-panel.html'),
          enabled: true,
        })
        .catch(() => {});

      return {
        success: true,
        tabId,
        windowId,
        alreadyOpen: false,
      };
    } catch (error) {
      void error;
    }
  }

  pendingKeylessProviderForOpenSidePanel = undefined;
  return undefined;
}

export const setupSidePanelPortInBg = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === SIDE_PANEL_PORT_NAME) {
      // reset side panel default path after 6 seconds
      //  to avoid the side panel being stuck in a modal on every time it opens.

      setTimeout(async () => {
        await extUtils.resetSidePanelPath();
      }, 6000);

      sidePanelState.isOpen = true;
      if (pendingKeylessProviderForOpenSidePanel) {
        port.postMessage({
          type: 'pushModal',
          payload: {
            modalParams: {
              screen: EModalRoutes.OnboardingModal,
              params: {
                screen: EOnboardingPagesV2.OneKeyIDLogin,
                params: {
                  mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
                  provider: pendingKeylessProviderForOpenSidePanel,
                },
              },
            },
          },
        });
        pendingKeylessProviderForOpenSidePanel = undefined;
      }

      let dappRejectId: string | number | undefined;
      const closeSidePanel = () => {
        sidePanelState.isOpen = false;
        if (dappRejectId) {
          const backgroundApiProxy = getBackgroundApiProxy();
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

  chrome.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (!isKeylessWebOpenSidePanelMessage(message)) {
        return;
      }

      void (async () => {
        const immediateResult = await tryImmediateOpenSidePanelOnMessage({
          sender,
          provider: message.payload?.provider,
        });
        if (immediateResult) {
          return immediateResult;
        }
        return openKeylessSidePanelByUserGesture({
          sender,
          provider: message.payload?.provider,
        });
      })()
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          sendResponse({
            success: false,
            error: errorMessage,
          });
        });

      return true;
    },
  );
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
            appGlobals.$navigationRef.current?.navigate(screen, params);
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
