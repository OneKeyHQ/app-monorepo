import { useCallback, useEffect, useRef, useState } from 'react';

import { range } from 'lodash';
import { useIntl } from 'react-intl';
import {
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Icon,
  LinearGradient,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildWalletCreatedAtISOString } from '@onekeyhq/shared/src/referralCode/creationRecordUtils';
import type { ICheckWalletBindStatusResponse } from '@onekeyhq/shared/src/referralCode/type';
import {
  type EOnboardingPagesV2,
  ERootRoutes,
  type IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { getKeylessOnboardingPin } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import {
  flushPendingExistingWalletSwitchToast,
  setExistingWalletSwitchToastDeferred,
} from '../../../utils/toastExistingWalletSwitch';
import { OnboardingPage } from '../components/Layout';
import {
  type IShowOnboardingInviteCodeDialog,
  useShowOnboardingInviteCodeDialog,
} from '../components/OnboardingInviteCodeDialog';
import { OrbShader } from '../components/OrbShader';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';
import { OnboardingTestIDs } from '../testIDs';

import type { SearchDevice } from '@onekeyfe/hd-core';

// Tail-cutoff for the bind-status prefetch in `handleLetsGo`. Short enough
// that an unhealthy referral backend never strands the user on this page;
// long enough that a healthy backend with a mild blip still gets through.
const REFERRAL_CHECK_TIMEOUT_MS = 1500;

const POPUP_LAYERED_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)';

const fixErrorString = (errorMessage: string) => {
  if (errorMessage.toLowerCase() === 'no wallet creation strategy') {
    return ETranslations.hardware_user_cancel_error;
  }
  return errorMessage;
};

// EncryptingData is declared in the enum but never emitted; fall back to the
// CreatingWallet copy so the UI has something to show if it ever appears.
const STEP_MESSAGE_IDS: Record<EFinalizeWalletSetupSteps, ETranslations> = {
  [EFinalizeWalletSetupSteps.ConnectingDevice]:
    ETranslations.connecting_your_device,
  [EFinalizeWalletSetupSteps.CreatingWallet]:
    ETranslations.onboarding_finalize_creating_wallet,
  [EFinalizeWalletSetupSteps.GeneratingAccounts]:
    ETranslations.onboarding_finalize_generating_accounts,
  [EFinalizeWalletSetupSteps.EncryptingData]:
    ETranslations.onboarding_finalize_creating_wallet,
  [EFinalizeWalletSetupSteps.Ready]: ETranslations.your_wallet_is_ready,
};

function StepTextSwap({ text }: { text: string }) {
  return (
    <YStack w="100%" h={32} position="relative" overflow="hidden">
      <AnimatePresence>
        <SizableText
          key={text}
          position="absolute"
          top={0}
          left={0}
          right={0}
          size="$heading2xl"
          textAlign="center"
          animation="medium"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          enterStyle={{ opacity: 0, y: 16 }}
          exitStyle={{ opacity: 0, y: -16 }}
        >
          {text}
        </SizableText>
      </AnimatePresence>
    </YStack>
  );
}

// Invisible child of `<OnboardingPage>` whose only job is to call
// `useShowOnboardingInviteCodeDialog()` from a position where `PageContext`
// is available, so `useInPageDialog` can capture the page's `pagePortalId`.
// Without this, the hook captures `pagePortalId = undefined` and falls back
// to `FULL_WINDOW_OVERLAY_PORTAL` on iOS, which is rendered above the
// signature-confirm modal pushed by Apply.
function OnboardingInviteCodeDialogBridge({
  bridgeRef,
}: {
  bridgeRef: React.MutableRefObject<IShowOnboardingInviteCodeDialog | null>;
}) {
  const show = useShowOnboardingInviteCodeDialog();
  useEffect(() => {
    bridgeRef.current = show;
    return () => {
      if (bridgeRef.current === show) {
        bridgeRef.current = null;
      }
    };
  }, [show, bridgeRef]);
  return null;
}

function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const [setupError, setSetupError] = useState<
    | {
        messageId: ETranslations;
      }
    | undefined
  >(undefined);
  const [
    isWalletCreationReadyForReferralCheck,
    setIsWalletCreationReadyForReferralCheck,
  ] = useState(false);
  const [isWalletCreationRecordHandled, setIsWalletCreationRecordHandled] =
    useState(false);

  const created = useRef(false);
  const createdWalletRef = useRef<IDBWallet | undefined>(undefined);
  const mnemonic = route?.params?.mnemonic;
  const mnemonicType = route?.params?.mnemonicType;
  const keylessPackSetId = route?.params?.keylessPackSetId;
  const deviceData = route?.params?.deviceData;
  const isFirmwareVerified = route?.params?.isFirmwareVerified;
  const isWalletBackedUp = route?.params?.isWalletBackedUp;
  const isKeylessWallet = route?.params?.isKeylessWallet;
  const keylessDetailsInfo = route?.params?.keylessDetailsInfo;
  const shouldAutoResetKeylessPinAfterRestore =
    route?.params?.shouldAutoResetKeylessPinAfterRestore;

  // Hardware path starts with "Connecting to device" because connectDevice()
  // runs before the backend wallet creation pipeline emits any events.
  const initialStep = route?.params?.deviceData
    ? EFinalizeWalletSetupSteps.ConnectingDevice
    : EFinalizeWalletSetupSteps.CreatingWallet;

  const [currentStep, setCurrentStep] =
    useState<EFinalizeWalletSetupSteps>(initialStep);

  const stepQueue = useRef<EFinalizeWalletSetupSteps[]>([]);

  const closePageCalled = useRef(false);
  // Prefetched referral bind-status check started the moment the Ready step
  // fires. Reading off this ref in `handleLetsGo` avoids paying the network
  // round-trip after the user clicks Enter wallet — by then it's usually
  // already resolved, so the button feels instant.
  const referralCheckPromiseRef = useRef<
    Promise<ICheckWalletBindStatusResponse | undefined>
  >(Promise.resolve(undefined));

  const closePage = useCallback(() => {
    closePageCalled.current = true;
    void backgroundApiProxy.serviceHardware.clearForceTransportType();
    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
  }, [navigation]);

  const {
    setPendingKeylessAutoConnectWalletId,
    openKeylessAutoConnectDappModal,
  } = useKeylessWebFlowAutoConnectDapp();
  // The show function captures `pagePortalId` at hook-call time via
  // `usePageContext()` inside `useInPageDialog`. This call site sits OUTSIDE
  // the `<OnboardingPage>` (= `<Page>`) wrapper rendered below, so the
  // context is empty and the dialog would fall back to
  // `FULL_WINDOW_OVERLAY_PORTAL` on iOS — which sits above the signature
  // confirm modal and re-introduces the occlusion that 176b3c556c set out
  // to fix. Defer the hook to a bridge component mounted inside
  // `<OnboardingPage>` (Page context is available there); the ref carries
  // the captured callback back here so `handleLetsGo` can invoke it.
  const showInviteCodeDialogRef =
    useRef<IShowOnboardingInviteCodeDialog | null>(null);
  const readyReferralCheckHandledRef = useRef(false);

  // Hold the "existing wallet switched" toast until the user confirms with
  // Enter wallet, so it doesn't pop over the setup progress animation.
  useEffect(() => {
    setExistingWalletSwitchToastDeferred(true);
    return () => {
      // Flush before releasing so the toast still fires if the page was
      // dismissed without Enter wallet (hardware back, app kill, etc.);
      // the setter would otherwise drop the pending result.
      flushPendingExistingWalletSwitchToast();
      setExistingWalletSwitchToastDeferred(false);
    };
  }, []);

  // Ready state waits for the user's Let's-go press instead of auto-closing.
  // The 600ms delay gives the page-dismiss animation time to finish before
  // the auto-connect dapp modal appears on top of the next (Main) screen.
  // Before closing, check referral bind status; if the wallet is still
  // eligible to bind a referral code, show the onboarding invite code dialog
  // and defer the close flow to its onDone callback.
  const handleLetsGo = useCallback(async () => {
    if (closePageCalled.current) return;

    const createdWallet = createdWalletRef.current;

    const proceedToWallet = () => {
      closePage();
      flushPendingExistingWalletSwitchToast();
      void (async () => {
        await timerUtils.wait(600);
        void openKeylessAutoConnectDappModal();
      })();
    };

    if (createdWallet) {
      try {
        // Await the prefetched promise. If it already resolved while the
        // user was lingering on the success page, this returns immediately
        // (instant Enter wallet). The tail-cutoff only kicks in when the
        // backend is genuinely unhealthy — in which case skipping the
        // dialog is the right call; the user can still bind from Settings.
        const checkResp = await createTimeoutPromise<
          ICheckWalletBindStatusResponse | undefined
        >({
          asyncFunc: () => referralCheckPromiseRef.current,
          timeout: REFERRAL_CHECK_TIMEOUT_MS,
          timeoutResult: undefined,
        });

        if (checkResp) {
          const isBound =
            checkResp.data || checkResp.reason === 'already_bound';
          const isExpired = checkResp.reason === 'exceeded_bind_window';

          if (!isBound && !isExpired) {
            showInviteCodeDialogRef.current?.({
              wallet: createdWallet,
              onDone: proceedToWallet,
            });
            return;
          }
        }
      } catch {
        // Server unreachable / unexpected error — skip dialog, fall through
        // to the original close flow so onboarding still completes.
      }
    }

    proceedToWallet();
  }, [closePage, openKeylessAutoConnectDappModal]);

  const processNextStep = useCallback(() => {
    while (stepQueue.current.length > 0) {
      const nextStep = stepQueue.current.shift();
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  }, []);

  const goNextStep = useCallback(
    (step: EFinalizeWalletSetupSteps) => {
      if (!stepQueue.current.includes(step)) {
        stepQueue.current.push(step);
      }
      processNextStep();
    },
    [processNextStep],
  );

  const actions = useAccountSelectorActions();

  const { connectDevice, createHWWallet } = useDeviceConnect();
  const createWallet = useCallback(async () => {
    try {
      let hdWalletCreatedResult:
        | {
            wallet: IDBWallet;
            indexedAccount: IDBIndexedAccount | undefined;
            isOverrideWallet: boolean | undefined;
          }
        | undefined;
      if (mnemonic && !created.current) {
        await withPromptPasswordVerify({
          run: async () => {
            if (mnemonicType === EMnemonicType.TON) {
              await actions.current.createTonImportedWallet({ mnemonic });
              return;
            }
            const shouldRunAutoReset =
              !!isKeylessWallet && !!shouldAutoResetKeylessPinAfterRestore;
            hdWalletCreatedResult = await actions.current.createHDWallet({
              mnemonic,
              isWalletBackedUp,
              isKeylessWallet,
              keylessDetailsInfo,
            });
            // `isOverrideWallet` is set by serviceAccount when the same-hash
            // dedup branch ran — i.e. the mnemonic matches an existing
            // wallet. The invite-code dialog is a setup ritual for first-
            // time creation only, so skip the bind check on re-imports.
            // Mirrors the HW branch's `existingWalletIds` filter.
            if (!hdWalletCreatedResult.isOverrideWallet) {
              createdWalletRef.current = hdWalletCreatedResult.wallet;
            }
            if (shouldRunAutoReset) {
              void (async () => {
                try {
                  if (!keylessDetailsInfo?.keylessOwnerId) {
                    return;
                  }
                  const refreshResult =
                    await backgroundApiProxy.serviceKeylessWallet.tryRefreshTokenFromStorage(
                      {
                        ownerId: keylessDetailsInfo?.keylessOwnerId,
                        forceRefresh: true,
                      },
                    );
                  if (
                    !refreshResult?.accessToken ||
                    !refreshResult?.refreshToken
                  ) {
                    return;
                  }
                  const { accessToken: token, refreshToken } = refreshResult;
                  const pin = await getKeylessOnboardingPin();
                  if (!token || !pin || !refreshToken) {
                    console.error(
                      'Skip keyless auto reset pin: missing onboarding token or pin.',
                    );
                    return;
                  }

                  await backgroundApiProxy.serviceKeylessWallet.autoResetKeylessWalletPinAfterRestoreForSameEmailAccount(
                    {
                      token,
                      refreshToken: refreshToken || undefined,
                      pin,
                    },
                  );
                } catch (autoResetError) {
                  console.error(
                    'autoResetKeylessWalletPinAfterRestoreForSameEmailAccount error:',
                    autoResetError,
                  );
                }
              })();
            }

            if (isKeylessWallet && keylessDetailsInfo) {
              defaultLogger.account.wallet.walletAdded({
                status: 'success',
                addMethod: 'CreateKeylessWallet',
                isSoftwareWalletOnlyUser: true,
                details: {
                  provider:
                    keylessDetailsInfo.keylessProvider ===
                    EOAuthSocialLoginProvider.Google
                      ? 'google'
                      : 'apple',
                },
              });

              if (
                platformEnv.isExtension &&
                accountUtils.isKeylessWallet({
                  walletId: hdWalletCreatedResult?.wallet.id,
                })
              ) {
                setPendingKeylessAutoConnectWalletId(
                  hdWalletCreatedResult?.wallet.id,
                );
              }
            }
          },
        });
        created.current = true;
      } else if (deviceData && isFirmwareVerified !== undefined) {
        const { wallets: walletsBeforeCreate } =
          await backgroundApiProxy.serviceAccount.getWallets({
            nestedHiddenWallets: false,
          });
        const existingWalletIds = new Set(
          walletsBeforeCreate.map((walletItem) => walletItem.id),
        );
        if (deviceData.vendor) {
          // Third-party vendor device (e.g., Ledger): call
          // createHWWalletWithoutHidden directly to avoid the
          // onSelectAddWalletType path which would push another
          // FinalizeWalletSetup page on top of this one.
          await actions.current.createHWWalletWithoutHidden({
            device: deviceData.device as SearchDevice,
            hideCheckingDeviceLoading: true,
            features: {
              device_id: (deviceData.device as SearchDevice)?.deviceId || '',
              vendor: deviceData.vendor,
            } as IOneKeyDeviceFeatures,
            isFirmwareVerified: true,
            defaultIsTemp: true,
            vendor: deviceData.vendor,
          });
        } else {
          goNextStep(EFinalizeWalletSetupSteps.ConnectingDevice);
          await connectDevice(deviceData.device as SearchDevice);
          await createHWWallet({
            device: deviceData.device as SearchDevice,
            isFirmwareVerified,
          });
        }
        const { wallets: walletsAfterCreate } =
          await backgroundApiProxy.serviceAccount.getWallets({
            nestedHiddenWallets: false,
          });
        const createdWallet =
          walletsAfterCreate.find(
            (walletItem) =>
              !existingWalletIds.has(walletItem.id) &&
              !accountUtils.isHwHiddenWallet({ wallet: walletItem }),
          ) ??
          walletsAfterCreate.find(
            (walletItem) => !existingWalletIds.has(walletItem.id),
          );
        if (createdWallet) {
          createdWalletRef.current = createdWallet;
        }
      } else if (keylessPackSetId && !created.current) {
        created.current = true;
      }
      setIsWalletCreationReadyForReferralCheck(true);
    } catch (error) {
      console.error('createWallet error:', error);
      const hardwareError = error as {
        messageId: ETranslations;
        message: string;
      };
      setSetupError({
        messageId: fixErrorString(
          hardwareError
            ? hardwareError.messageId ||
                hardwareError.message ||
                ETranslations.global_unknown_error
            : ETranslations.global_unknown_error,
        ) as ETranslations,
      });
    }
  }, [
    mnemonic,
    deviceData,
    isFirmwareVerified,
    keylessPackSetId,
    mnemonicType,
    actions,
    isWalletBackedUp,
    isKeylessWallet,
    keylessDetailsInfo,
    shouldAutoResetKeylessPinAfterRestore,
    connectDevice,
    createHWWallet,
    setPendingKeylessAutoConnectWalletId,
    goNextStep,
  ]);

  useEffect(() => {
    void createWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupStep],
    ) => {
      goNextStep(event.step);
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    };
  }, [goNextStep]);

  useConnectDeviceError(
    useCallback((errorMessageId) => {
      setSetupError({
        messageId: errorMessageId,
      });
    }, []),
  );

  const retrySetup = useCallback(() => {
    setSetupError(undefined);
    setCurrentStep(initialStep);
    stepQueue.current = [];
    createdWalletRef.current = undefined;
    readyReferralCheckHandledRef.current = false;
    referralCheckPromiseRef.current = Promise.resolve(undefined);
    setIsWalletCreationReadyForReferralCheck(false);
    setIsWalletCreationRecordHandled(false);
    // Reset the dedup guard so a retry triggered after a late, post-success
    // error (e.g. a hardware-connect event firing after a non-hardware
    // wallet was already created) can re-enter the create-wallet branch
    // instead of being short-circuited.
    created.current = false;
    void createWallet();
  }, [createWallet, initialStep]);

  const { gtMd } = useMedia();
  const theme = useTheme();

  const isReady = currentStep === EFinalizeWalletSetupSteps.Ready;
  const stepText = intl.formatMessage({ id: STEP_MESSAGE_IDS[currentStep] });

  useEffect(() => {
    // Hardware wallet creation may emit Ready before the post-create wallet
    // lookup has stored createdWalletRef.
    if (
      !isReady ||
      setupError ||
      !isWalletCreationReadyForReferralCheck ||
      readyReferralCheckHandledRef.current
    ) {
      return;
    }
    readyReferralCheckHandledRef.current = true;
    // Unblock the Enter wallet button immediately. The record persistence
    // below is best-effort (the startup migration retries with the cached
    // timestamp) and the server-side call can hang for ~10s if referral
    // endpoints are unhealthy — gating the CTA on it would strand the user.
    setIsWalletCreationRecordHandled(true);

    const createdWallet = createdWalletRef.current;
    if (!createdWallet) return;

    // Single round-trip shared by the record-write below and the bind-status
    // prefetch — both want the same { address, networkId } for this wallet.
    const walletInfoPromise =
      backgroundApiProxy.serviceReferralCode.getReferralCodeWalletInfo({
        walletId: createdWallet.id,
      });

    // Best-effort record write. Startup migration retries from the cached
    // creation timestamp if this fails (network down, backend hiccup, etc.).
    void (async () => {
      try {
        const walletCreatedAt = buildWalletCreatedAtISOString();
        await backgroundApiProxy.serviceReferralCode.cacheWalletCreationRecordTimestamp(
          {
            walletId: createdWallet.id,
            walletCreatedAt,
          },
        );
        const info = await walletInfoPromise;
        if (info) {
          await backgroundApiProxy.serviceReferralCode.recordWalletCreation([
            {
              address: info.address,
              networkId: info.networkId,
              walletCreatedAt,
            },
          ]);
        }
      } catch {
        // Best-effort; startup migration will retry.
      }
    })();

    // Prefetch bind status so the user's Enter wallet click feels instant.
    // By the time they finish the success animation, this is usually done.
    referralCheckPromiseRef.current = (async () => {
      try {
        const info = await walletInfoPromise;
        if (!info) return undefined;
        return await backgroundApiProxy.serviceReferralCode.checkWalletBindStatus(
          {
            address: info.address,
            networkId: info.networkId,
          },
        );
      } catch {
        return undefined;
      }
    })();
  }, [isReady, isWalletCreationReadyForReferralCheck, setupError]);

  // Breathe up to 0.8 during active steps; on Ready fade to a faint hold
  // (0.15) so the orb visibly "settles" before the user taps Enter wallet.
  const orbIntensity = useSharedValue(0);
  useEffect(() => {
    if (isReady) {
      orbIntensity.value = withTiming(0.15, { duration: 600 });
      return;
    }
    orbIntensity.value = withRepeat(
      withTiming(0.8, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [isReady, orbIntensity]);

  // Release the shader canvas ~1s after Ready so the GPU isn't running a
  // per-frame noise pass while the user lingers on the success badge.
  const [isOrbMounted, setIsOrbMounted] = useState(true);
  useEffect(() => {
    if (!isReady) {
      setIsOrbMounted(true);
      return undefined;
    }
    const timeout = setTimeout(() => setIsOrbMounted(false), 1000);
    return () => clearTimeout(timeout);
  }, [isReady]);

  const orbSize = 160;
  const isReadyActionVisible = isReady && isWalletCreationRecordHandled;

  const [isExtensionTopRightVisible, setIsExtensionTopRightVisible] =
    useState(false);
  useEffect(() => {
    if (!platformEnv.isExtension || !isReadyActionVisible || setupError) {
      setIsExtensionTopRightVisible(false);
      return undefined;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        // chrome.action.getUserSettings (Chrome 91+) reports whether the
        // extension is already pinned to the toolbar. If pinned, the hint
        // is redundant. Older Chrome / non-Chrome → fall through and show
        // the hint as before.
        const settings = await chrome.action?.getUserSettings?.();
        if (cancelled) {
          return;
        }
        if (settings?.isOnToolbar) {
          return;
        }
      } catch {
        // Permission / version edge cases — show the hint anyway.
      }
      if (cancelled) {
        return;
      }
      timeout = setTimeout(() => {
        if (!cancelled) {
          setIsExtensionTopRightVisible(true);
        }
      }, 1000);
    })();

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isReadyActionVisible, setupError]);

  const enterWalletTransitionProps = {
    opacity: isReadyActionVisible ? 1 : 0,
    pointerEvents: isReadyActionVisible ? ('auto' as const) : ('none' as const),
    ...(!platformEnv.isNative && {
      animation: 'quick' as const,
      animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
    }),
  };

  const enterWalletButton = (
    <Button
      testID={OnboardingTestIDs.finalizeSetupEnterWalletBtn}
      variant="primary"
      size="large"
      onPress={handleLetsGo}
      iconAfter="ArrowRightOutline"
      animation="quick"
      animateOnly={['opacity']}
      enterStyle={{ opacity: 0 }}
      {...(gtMd ? { minWidth: 240 } : { w: '100%' as const })}
    >
      {intl.formatMessage({ id: ETranslations.enter_wallet })}
    </Button>
  );

  return (
    <OnboardingPage
      testID={OnboardingTestIDs.finalizeSetupPage}
      headerBack={false}
      showLanguageSelector={false}
      enterAnimation={false}
    >
      <OnboardingInviteCodeDialogBridge bridgeRef={showInviteCodeDialogRef} />
      <YStack flex={1}>
        {platformEnv.isExtension && isExtensionTopRightVisible ? (
          <YStack
            gap="$4"
            zIndex={10}
            top="$4"
            right="$4"
            style={{ position: 'fixed' }}
            borderRadius="$4"
            p="$4"
            bg="$bg"
            width="$72"
            $platform-web={{
              boxShadow: POPUP_LAYERED_SHADOW,
            }}
            enterStyle={{
              y: '$-2',
              opacity: 0,
            }}
            animation="quick"
            animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          >
            <SizableText>
              {intl.formatMessage({
                id: ETranslations.onboarding_ext_popup_text,
              })}
            </SizableText>
            <XStack gap="$2" position="relative">
              <XStack
                flex={1}
                py="$2"
                px="$4"
                borderRadius="$full"
                bg="$bgStrong"
                justifyContent="space-between"
                alignItems="center"
              >
                {range(6).map((index) => (
                  <YStack
                    key={index}
                    w="$4"
                    h="$4"
                    borderWidth={1.5}
                    borderColor="$iconDisabled"
                    borderStyle="dashed"
                    borderRadius="$full"
                  />
                ))}
              </XStack>
              <YStack p="$2" borderRadius="$full" bg="$bgStrong">
                <Icon name="PuzzleOutline" color="$iconActive" size="$5" />
              </YStack>
              <LinearGradient
                colors={[theme.bg.val, `${theme.bg.val}00`]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
                pointerEvents="none"
              />
            </XStack>
            <XStack
              px="$4"
              py="$3"
              bg="$neutral2"
              borderRadius="$3"
              $platform-web={{
                boxShadow: POPUP_LAYERED_SHADOW,
              }}
              gap="$2"
              alignItems="center"
            >
              <Icon name="OnekeyBrand" />
              <SizableText flex={1} size="$bodyLgMedium">
                OneKey
              </SizableText>
              <Icon name="ThumbtackSolid" size="$5" color="$iconInfo" />
            </XStack>
          </YStack>
        ) : null}
        {setupError ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$7">
            <SizableText size="$heading5xl" fontWeight={600}>
              {intl.formatMessage({
                id: ETranslations.failed_to_create_wallet,
              })}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              maxWidth={620}
              pl="$3"
              borderLeftWidth={1}
              borderLeftColor="$borderSubdued"
            >
              {intl.formatMessage({
                id: setupError.messageId,
                defaultMessage: setupError.messageId,
              })}
            </SizableText>
            <XStack gap="$2.5" mt="$4" maxWidth={420}>
              <Button
                testID={OnboardingTestIDs.finalizeSetupRetryBtn}
                flex={1}
                variant="primary"
                size="large"
                onPress={retrySetup}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
              <Button
                testID={OnboardingTestIDs.finalizeSetupExitBtn}
                flex={1}
                size="large"
                onPress={closePage}
              >
                {intl.formatMessage({ id: ETranslations.global_exit })}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <>
            <YStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              gap="$8"
            >
              <YStack w={orbSize} h={orbSize} position="relative">
                <YStack
                  position="absolute"
                  inset={0}
                  animation="medium"
                  animateOnly={ANIMATE_ONLY_OPACITY}
                  opacity={isReady ? 0 : 1}
                >
                  {isOrbMounted ? (
                    <OrbShader
                      intensity={orbIntensity}
                      paused={isReady}
                      autoRotate
                      size={orbSize}
                    />
                  ) : null}
                </YStack>
                <YStack
                  position="absolute"
                  left="20%"
                  top="20%"
                  bottom="20%"
                  right="20%"
                  borderRadius={orbSize / 2}
                  bg="$brand10"
                  alignItems="center"
                  justifyContent="center"
                  animation="medium"
                  animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                  opacity={isReady ? 1 : 0}
                  scale={isReady ? 1 : 0.7}
                >
                  <Icon name="CheckmarkSolid" size="$8" color="$bgApp" />
                </YStack>
              </YStack>
              <StepTextSwap text={stepText} />
              {gtMd ? (
                <YStack mt="$4" minHeight={48} {...enterWalletTransitionProps}>
                  {enterWalletButton}
                </YStack>
              ) : null}
            </YStack>
            {!gtMd ? (
              <YStack pb="$5" {...enterWalletTransitionProps}>
                {enterWalletButton}
              </YStack>
            ) : null}
          </>
        )}
      </YStack>
    </OnboardingPage>
  );
}

export function FinalizeWalletSetup({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <FinalizeWalletSetupPage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}

export default FinalizeWalletSetup;
