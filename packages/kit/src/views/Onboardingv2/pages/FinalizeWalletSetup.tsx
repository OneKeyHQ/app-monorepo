import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
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
import {
  type EOnboardingPagesV2,
  ERootRoutes,
  type IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { getKeylessOnboardingPin } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useInterval } from '../../../hooks/useInterval';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import {
  flushPendingExistingWalletSwitchToast,
  setExistingWalletSwitchToastDeferred,
} from '../../../utils/toastExistingWalletSwitch';
import { OnboardingPage } from '../components/Layout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';

import type { SearchDevice } from '@onekeyfe/hd-core';

const fixErrorString = (errorMessage: string) => {
  if (errorMessage.toLowerCase() === 'no wallet creation strategy') {
    return ETranslations.hardware_user_cancel_error;
  }
  return errorMessage;
};

// Only the steps the pipeline actually emits (see actions.tsx
// withFinalizeWalletSetupStep). EFinalizeWalletSetupSteps.EncryptingData is
// declared in the enum but never emitted, so it gets no copy here.
// TODO(i18n): step copy and eyebrow labels — Lokalise keys TBD
const STEP_CONFIG: Partial<
  Record<EFinalizeWalletSetupSteps, { mono: string; copy: string }>
> = {
  [EFinalizeWalletSetupSteps.ConnectingDevice]: {
    mono: 'LINK',
    copy: 'One moment while we open a secure line to your device.',
  },
  [EFinalizeWalletSetupSteps.CreatingWallet]: {
    mono: 'FORGE',
    copy: 'Forging a wallet that only you can unlock, on this device.',
  },
  [EFinalizeWalletSetupSteps.GeneratingAccounts]: {
    mono: 'DERIVE',
    copy: "Deriving your accounts from the wallet's root key.",
  },
  [EFinalizeWalletSetupSteps.Ready]: {
    mono: 'READY',
    copy: 'Everything is sealed. Your wallet is ready to use.',
  },
};

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  const [on, setOn] = useState(true);
  useInterval(() => setOn((v) => !v), 700);

  return (
    <YStack
      w={size}
      h={size}
      borderRadius={size / 2}
      bg={color}
      shadowColor={color}
      shadowOpacity={1}
      shadowRadius={12}
      shadowOffset={{ width: 0, height: 0 }}
      animation="slow"
      animateOnly={ANIMATE_ONLY_OPACITY}
      opacity={on ? 1 : 0.4}
    />
  );
}

function StepEyebrow({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <XStack gap="$3" alignItems="center">
      <PulsingDot color={color} />
      <SizableText
        size="$bodySm"
        color={color}
        letterSpacing={3}
        textTransform="uppercase"
      >
        {children}
      </SizableText>
    </XStack>
  );
}

function SentenceSwap({
  lines,
  activeIndex,
}: {
  lines: string[];
  activeIndex: number;
}) {
  // Container is sized for 3 lines at mobile (heading3xl lineHeight 36 * 3 = 108)
  // and 2 lines at desktop (heading5xl lineHeight 48 * 2 = 96). AnimatePresence
  // overlaps the outgoing + incoming text via absolute positioning so the
  // container height stays stable while the slot-machine animation runs.
  return (
    <YStack position="relative" h={96} overflow="hidden" $md={{ h: 108 }}>
      <AnimatePresence>
        <SizableText
          key={activeIndex}
          position="absolute"
          top={0}
          left={0}
          right={0}
          size="$heading5xl"
          fontWeight={600}
          letterSpacing={-0.5}
          numberOfLines={3}
          $md={{ size: '$heading3xl', letterSpacing: -0.4 }}
          animation="medium"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          enterStyle={{ opacity: 0, y: 24 }}
          exitStyle={{ opacity: 0, y: -24 }}
        >
          {lines[activeIndex] ?? ''}
        </SizableText>
      </AnimatePresence>
    </YStack>
  );
}

function ProgressTicks({
  stepIndex,
  total,
  color,
  isReady,
}: {
  stepIndex: number;
  total: number;
  color: string;
  isReady: boolean;
}) {
  // Tamagui's shadow* props alone render too faintly on a 2px bar, so we also
  // set an explicit web boxShadow. Resolve the accent hex from the theme so
  // the glow stays in sync with light/dark.
  const theme = useTheme();
  const glowHex = theme.brand9?.val ?? color;
  return (
    <XStack gap="$2" w={280} $md={{ w: 180, gap: '$1.5' }}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i <= stepIndex;
        const isCurrent = i === stepIndex && !isReady;
        return (
          <YStack
            key={i}
            flex={1}
            h={2}
            mt="$10"
            animation="medium"
            bg={filled ? color : '$borderSubdued'}
            {...(isCurrent && {
              shadowColor: color,
              shadowOpacity: 1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
              '$platform-web': {
                boxShadow: `0 0 10px ${glowHex}, 0 0 4px ${glowHex}`,
              },
            })}
          />
        );
      })}
    </XStack>
  );
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

  const created = useRef(false);
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
  const handleLetsGo = useCallback(async () => {
    if (closePageCalled.current) return;
    closePage();
    flushPendingExistingWalletSwitchToast();
    await timerUtils.wait(600);
    void openKeylessAutoConnectDappModal();
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
                  const [token, refreshToken, pin] = await Promise.all([
                    refreshResult.accessToken,
                    refreshResult.refreshToken,
                    getKeylessOnboardingPin(),
                  ]);
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
      } else if (keylessPackSetId && !created.current) {
        created.current = true;
      }
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
    void createWallet();
  }, [createWallet, initialStep]);

  // Hardware path shows all 4 steps; other paths skip ConnectingDevice.
  const activeSteps = useMemo(
    () =>
      deviceData
        ? [
            EFinalizeWalletSetupSteps.ConnectingDevice,
            EFinalizeWalletSetupSteps.CreatingWallet,
            EFinalizeWalletSetupSteps.GeneratingAccounts,
            EFinalizeWalletSetupSteps.Ready,
          ]
        : [
            EFinalizeWalletSetupSteps.CreatingWallet,
            EFinalizeWalletSetupSteps.GeneratingAccounts,
            EFinalizeWalletSetupSteps.Ready,
          ],
    [deviceData],
  );

  const { gtMd } = useMedia();

  const isReady = currentStep === EFinalizeWalletSetupSteps.Ready;
  const stepIndex = Math.max(0, activeSteps.indexOf(currentStep));
  const total = activeSteps.length;
  // activeSteps only contains keys that exist in STEP_CONFIG, so these
  // lookups are non-null at runtime.
  const stepConfig =
    STEP_CONFIG[currentStep] ??
    STEP_CONFIG[EFinalizeWalletSetupSteps.CreatingWallet]!;
  const accentColor = '$brand9';
  const sentences = useMemo(
    () => activeSteps.map((s) => STEP_CONFIG[s]!.copy),
    [activeSteps],
  );

  const enterWalletTransitionProps = {
    opacity: isReady ? 1 : 0,
    pointerEvents: isReady ? 'auto' : 'none',
    ...(!platformEnv.isNative && {
      animation: 'quick' as const,
      animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
    }),
  };

  const enterWalletButton = (
    <Button
      variant="primary"
      size="large"
      onPress={handleLetsGo}
      iconAfter="ArrowRightOutline"
      {...(gtMd
        ? { alignSelf: 'flex-start' as const, minWidth: 240 }
        : { w: '100%' as const })}
    >
      {/* TODO(i18n): ETranslations.onboarding_finalize_enter_wallet */}
      Enter wallet
    </Button>
  );

  return (
    <OnboardingPage
      headerBack={false}
      showLanguageSelector={false}
      enterAnimation={false}
    >
      <YStack flex={1}>
        {setupError ? (
          <YStack flex={1} justifyContent="center" gap="$7">
            <StepEyebrow color="$textCritical">
              Error / setup interrupted
            </StepEyebrow>
            <SizableText size="$heading5xl" fontWeight={600}>
              {/* TODO(i18n): ETranslations.onboarding_finalize_error_interrupted */}
              Something interrupted the setup. We haven&apos;t written anything
              — try again.
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
                flex={1}
                variant="primary"
                size="large"
                onPress={retrySetup}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
              <Button flex={1} size="large" onPress={closePage}>
                {intl.formatMessage({ id: ETranslations.global_exit })}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <>
            <YStack flex={1} justifyContent="center" gap="$7">
              <StepEyebrow color={accentColor}>
                {`${stepConfig.mono} • 0${stepIndex + 1} / 0${total}`}
              </StepEyebrow>
              <SentenceSwap lines={sentences} activeIndex={stepIndex} />
              <ProgressTicks
                stepIndex={stepIndex}
                total={total}
                color={accentColor}
                isReady={isReady}
              />
              {gtMd ? (
                <YStack mt="$4" minHeight={48} {...enterWalletTransitionProps}>
                  {enterWalletButton}
                </YStack>
              ) : null}
            </YStack>
            {!gtMd ? (
              <YStack {...enterWalletTransitionProps}>
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
