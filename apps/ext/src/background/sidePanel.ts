import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ONBOARDING_FROM_EXT_PARAM } from '@onekeyhq/shared/src/consts/onboardingConsts';
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
import { EOnboardingV2Routes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  type IOnboardingAutoConnectOrigin,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';

const SIDE_PANEL_PORT_NAME = 'ONEKEY_SIDE_PANEL';

let pendingKeylessGetStartedParams:
  | ReturnType<typeof buildKeylessGetStartedParams>
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

function buildKeylessGetStartedParams({
  senderUrl,
  provider,
  nonce,
}: {
  senderUrl: string | undefined;
  provider: EOAuthSocialLoginProvider;
  nonce?: string;
}) {
  let autoConnectOrigin: IOnboardingAutoConnectOrigin | undefined;

  if (senderUrl) {
    try {
      autoConnectOrigin = new URL(senderUrl).origin;
    } catch {
      autoConnectOrigin = undefined;
    }
  }

  return {
    ...ONBOARDING_FROM_EXT_PARAM,
    autoConnectOrigin,
    autoLoginKeylessProvider: provider,
    autoConnectNonce: nonce,
  } as const;
}

function buildKeylessGetStartedModalMessage(
  params: ReturnType<typeof buildKeylessGetStartedParams>,
) {
  return {
    type: 'pushModal',
    payload: {
      modalParams: {
        screen: ERootRoutes.Onboarding,
        params: {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
            params,
          },
        },
      },
    },
  } as const;
}

function pushKeylessGetStartedToSidePanel(
  params: ReturnType<typeof buildKeylessGetStartedParams>,
) {
  appEventBus.emit(
    EAppEventBusNames.SidePanel_BgToUI,
    buildKeylessGetStartedModalMessage(params),
  );
}

async function openKeylessSidePanelByUserGesture({
  sender,
  payload,
}: {
  sender: chrome.runtime.MessageSender;
  payload?: {
    provider?: EOAuthSocialLoginProvider;
    nonce?: string;
  };
}) {
  if (!chrome.sidePanel?.open) {
    throw new OneKeyLocalError('side panel api is unavailable');
  }
  if (!payload?.provider) {
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

  const getStartedParams = buildKeylessGetStartedParams({
    senderUrl: sender.url,
    provider: payload.provider,
    nonce: payload.nonce,
  });

  if (sidePanelState.isOpen) {
    pushKeylessGetStartedToSidePanel(getStartedParams);
    return {
      success: true,
      tabId,
      windowId,
      alreadyOpen: true,
    };
  }

  pendingKeylessGetStartedParams = getStartedParams;
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
    pendingKeylessGetStartedParams = undefined;
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
  payload,
}: {
  sender: chrome.runtime.MessageSender;
  payload?: {
    provider?: EOAuthSocialLoginProvider;
    nonce?: string;
  };
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
    sidePanelState.isOpen ||
    !chrome.sidePanel?.open ||
    typeof tabId !== 'number' ||
    typeof windowId !== 'number' ||
    !payload?.provider
  ) {
    return undefined;
  }

  if (!isKeylessWebAutoConnectOriginAllowed(sender.url)) {
    return undefined;
  }

  const getStartedParams = buildKeylessGetStartedParams({
    senderUrl: sender.url,
    provider: payload.provider,
    nonce: payload.nonce,
  });

  pendingKeylessGetStartedParams = getStartedParams;

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

  pendingKeylessGetStartedParams = undefined;
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
      if (pendingKeylessGetStartedParams) {
        port.postMessage(
          buildKeylessGetStartedModalMessage(pendingKeylessGetStartedParams),
        );
        pendingKeylessGetStartedParams = undefined;
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
          payload: message.payload,
        });
        if (immediateResult) {
          return immediateResult;
        }
        return openKeylessSidePanelByUserGesture({
          sender,
          payload: message.payload,
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
            void (async () => {
              await waitForDataLoaded({
                data: () => appGlobals.$rootAppNavigation,
                logName: 'side_panel_wait_root_app_navigation',
                wait: 100,
                timeout: 10_000,
              });

              if (screen === ERootRoutes.Onboarding) {
                appGlobals.$rootAppNavigation?.navigate(screen, params);
                return;
              }

              appGlobals.$rootAppNavigation?.pushModal(screen, params);
            })().catch(() => {
              appGlobals.$navigationRef.current?.navigate(screen, params);
            });
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
