import { StackActions } from '@react-navigation/native';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  ONBOARDING_CREATE_NEW_WALLET_PATH,
  ONBOARDING_FROM_EXT_PARAM,
} from '@onekeyhq/shared/src/consts/onboardingConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import keylessWebBridge from '@onekeyhq/shared/src/keylessWallet/keylessWebBridge';
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
const SIDE_PANEL_DAPP_MOUNT_ACK_TIMEOUT_MS = 3000;

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
            screen: EOnboardingPagesV2.CreateNewWallet,
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

function extractQueryFromModalParams(modalParams: unknown): string | undefined {
  if (!modalParams || typeof modalParams !== 'object') {
    return undefined;
  }

  const params = modalParams as {
    query?: unknown;
    params?: unknown;
  };

  if (typeof params.query === 'string') {
    return params.query;
  }

  return extractQueryFromModalParams(params.params);
}

function extractDappRejectIdFromModalParams(
  modalParams: unknown,
): number | string | undefined {
  const query = extractQueryFromModalParams(modalParams);
  if (!query) {
    return undefined;
  }

  try {
    const queryInfo = JSON.parse(query) as {
      $sourceInfo?: {
        id?: number | string;
      };
    };

    if (
      typeof queryInfo.$sourceInfo?.id === 'number' ||
      typeof queryInfo.$sourceInfo?.id === 'string'
    ) {
      return queryInfo.$sourceInfo.id;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function emitSidePanelDappMountFailed(params: {
  rejectId: number | string;
  errorMessage?: string;
}) {
  appEventBus.emit(EAppEventBusNames.SidePanel_UIToBg, {
    type: 'rejectDappRequest',
    payload: params,
  });
}

function waitForSidePanelDappRejectIdAck({
  rejectId,
  timeoutMs = SIDE_PANEL_DAPP_MOUNT_ACK_TIMEOUT_MS,
}: {
  rejectId: number | string;
  timeoutMs?: number;
}) {
  return new Promise<boolean>((resolve) => {
    let finished = false;
    const timerRef: { current?: ReturnType<typeof setTimeout> } = {};
    const onAckRef: {
      current?: (
        params: IAppEventBusPayload[EAppEventBusNames.SidePanel_UIToBg],
      ) => void;
    } = {};

    const finish = (didAck: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timerRef.current);
      if (onAckRef.current) {
        appEventBus.off(EAppEventBusNames.SidePanel_UIToBg, onAckRef.current);
      }
      resolve(didAck);
    };

    const onAck = (
      params: IAppEventBusPayload[EAppEventBusNames.SidePanel_UIToBg],
    ) => {
      if (params.type !== 'dappRejectId') {
        return;
      }
      if (params.payload.rejectId !== rejectId) {
        return;
      }

      finish(true);
    };
    onAckRef.current = onAck;

    timerRef.current = setTimeout(() => {
      finish(false);
    }, timeoutMs);

    appEventBus.on(EAppEventBusNames.SidePanel_UIToBg, onAck);
  });
}

async function syncPendingKeylessWebTabForAutoConnect({
  tabId,
  getStartedParams,
}: {
  tabId: number;
  getStartedParams: ReturnType<typeof buildKeylessGetStartedParams>;
}) {
  const autoConnectOrigin = getStartedParams.autoConnectOrigin;
  const nonce = getStartedParams.autoConnectNonce;

  if (!autoConnectOrigin || !nonce) {
    return;
  }

  await keylessWebBridge.savePendingWebTab({
    tabId,
    autoConnectParams: {
      nonce,
      autoConnectOrigin,
      autoLoginKeylessProvider: getStartedParams.autoLoginKeylessProvider,
    },
  });
}

function persistPendingKeylessWebTabForAutoConnect(params: {
  tabId: number;
  getStartedParams: ReturnType<typeof buildKeylessGetStartedParams>;
}) {
  void syncPendingKeylessWebTabForAutoConnect(params).catch((error) => {
    console.error('persistPendingKeylessWebTabForAutoConnect', error);
  });
}

// Validate the inbound keyless-open request and derive the parameters both
// the side-panel and the expand-tab transport need. Throws on any precondition
// failure so callers can either propagate (sidePanel) or attempt a fallback.
function parseKeylessOpenRequest({
  sender,
  payload,
}: {
  sender: chrome.runtime.MessageSender;
  payload?: {
    provider?: EOAuthSocialLoginProvider;
    nonce?: string;
  };
}) {
  if (!payload?.provider) {
    throw new OneKeyLocalError('provider is required');
  }
  if (!isKeylessWebAutoConnectOriginAllowed(sender.url)) {
    throw new OneKeyLocalError('origin is not allowed for keyless flow');
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
  return { tabId, windowId, getStartedParams };
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
  const { tabId, windowId, getStartedParams } = parseKeylessOpenRequest({
    sender,
    payload,
  });

  if (sidePanelState.isOpen) {
    persistPendingKeylessWebTabForAutoConnect({
      tabId,
      getStartedParams,
    });
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
    persistPendingKeylessWebTabForAutoConnect({
      tabId,
      getStartedParams,
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

// Fallback when chrome.sidePanel.open is unavailable or fails (e.g. user-
// gesture chain broken across contentScript → chrome.runtime.sendMessage →
// BG service worker). Opens the keyless onboarding in a full-screen
// expand-tab so the user lands on CreateNewWallet with auto-login params
// instead of falling through to a popup-driven /onboarding/get-started
// redirect that loses the provider hint.
async function openKeylessExpandTabFallback({
  sender,
  payload,
}: {
  sender: chrome.runtime.MessageSender;
  payload?: {
    provider?: EOAuthSocialLoginProvider;
    nonce?: string;
  };
}) {
  const { tabId, windowId, getStartedParams } = parseKeylessOpenRequest({
    sender,
    payload,
  });

  // Persist the pending tab so the post-onboarding bridge can later trigger
  // auto-connect on the originating web tab — same behavior as the
  // side-panel path.
  persistPendingKeylessWebTabForAutoConnect({ tabId, getStartedParams });

  await extUtils.openExpandTab({
    path: ONBOARDING_CREATE_NEW_WALLET_PATH,
    params: {
      ...ONBOARDING_FROM_EXT_PARAM,
      ...(getStartedParams.autoConnectOrigin
        ? { autoConnectOrigin: getStartedParams.autoConnectOrigin }
        : {}),
      autoLoginKeylessProvider: getStartedParams.autoLoginKeylessProvider,
      ...(getStartedParams.autoConnectNonce
        ? { autoConnectNonce: getStartedParams.autoConnectNonce }
        : {}),
    },
  });

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
      persistPendingKeylessWebTabForAutoConnect({
        tabId,
        getStartedParams,
      });

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
        // Clear stale pending web tab storage so an abandoned keyless
        // onboarding flow does not auto-connect the wrong dapp later.
        void keylessWebBridge.clearPendingWebTabStorage().catch(() => {});
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
            case 'rejectDappRequest': {
              if (dappRejectId === payload.rejectId) {
                dappRejectId = undefined;
              }
              const backgroundApiProxy = getBackgroundApiProxy();
              void backgroundApiProxy.servicePromise.rejectCallback({
                id: payload.rejectId,
                error: new Error(
                  payload.errorMessage ||
                    'Dapp authorization rejected because side panel modal failed to mount.',
                ),
              });
              break;
            }
            default:
              break;
          }
        },
      );
      port.onDisconnect.addListener(() => {
        closeSidePanel();
        // Reset the side panel default path so the next open isn't stuck
        // on the previous keyless/modal route. Done on disconnect rather
        // than via a fixed timer after open — calling
        // chrome.sidePanel.setOptions({ path }) on an open panel reloads
        // it, which would yank the user away from in-flight flows like
        // OAuth (typical OAuth round-trip exceeds the old 6s timeout).
        void extUtils.resetSidePanelPath().catch(() => {});
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
        try {
          return await openKeylessSidePanelByUserGesture({
            sender,
            payload: message.payload,
          });
        } catch (sidePanelError) {
          // Side panel API can fail when the user-gesture chain doesn't
          // survive the contentScript → BG roundtrip (Chrome version /
          // dev-build / policy dependent). Fall back to the expand-tab
          // path with the same auto-login params so the user still lands
          // on CreateNewWallet rather than a generic onboarding entry.
          const fallbackResult = await openKeylessExpandTabFallback({
            sender,
            payload: message.payload,
          }).catch(() => undefined);
          if (fallbackResult) {
            return fallbackResult;
          }
          throw sidePanelError;
        }
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
            const rejectId = extractDappRejectIdFromModalParams(
              payload.modalParams,
            );
            const mountAckPromise = rejectId
              ? waitForSidePanelDappRejectIdAck({
                  rejectId,
                })
              : undefined;

            void (async () => {
              const rejectMountFailure = (error: unknown) => {
                if (!rejectId) {
                  return;
                }
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                emitSidePanelDappMountFailed({
                  rejectId,
                  errorMessage,
                });
              };

              const navigateToRoute = async () => {
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

                appGlobals.$navigationRef.current?.dispatch(
                  StackActions.push(screen, params),
                );
              };

              try {
                await navigateToRoute();
              } catch {
                try {
                  appGlobals.$navigationRef.current?.navigate(screen, params);
                } catch (fallbackError) {
                  rejectMountFailure(fallbackError);
                  return;
                }
              }

              if (!mountAckPromise || !rejectId) {
                return;
              }

              const didAck = await mountAckPromise;
              if (!didAck) {
                emitSidePanelDappMountFailed({
                  rejectId,
                  errorMessage: `Side panel failed to mount DApp modal for route: ${String(
                    screen,
                  )}`,
                });
              }
            })().catch((error) => {
              if (!rejectId) {
                return;
              }
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              emitSidePanelDappMountFailed({
                rejectId,
                errorMessage,
              });
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
