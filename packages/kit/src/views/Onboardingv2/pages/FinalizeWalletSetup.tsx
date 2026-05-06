import { useCallback, useEffect, useRef, useState } from 'react';

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
  SizableText,
  XStack,
  YStack,
  useMedia,
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
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import {
  flushPendingExistingWalletSwitchToast,
  setExistingWalletSwitchToastDeferred,
} from '../../../utils/toastExistingWalletSwitch';
import { OnboardingPage } from '../components/Layout';
import { OrbShader } from '../components/OrbShader';
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
            createdWalletRef.current = hdWalletCreatedResult.wallet;
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

  const isReady = currentStep === EFinalizeWalletSetupSteps.Ready;
  const stepText = intl.formatMessage({ id: STEP_MESSAGE_IDS[currentStep] });

  const handleWalletSetupReady = useCallback(async () => {
    const referralWalletId = createdWalletRef.current?.id;
    try {
      if (!referralWalletId) {
        return;
      }

      const walletCreatedAt = buildWalletCreatedAtISOString();
      await backgroundApiProxy.serviceReferralCode.cacheWalletCreationRecordTimestamp(
        {
          walletId: referralWalletId,
          walletCreatedAt,
        },
      );
      const info =
        await backgroundApiProxy.serviceReferralCode.getReferralCodeWalletInfo({
          walletId: referralWalletId,
        });
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
      // Startup migration will retry with the cached creation timestamp.
    } finally {
      setIsWalletCreationRecordHandled(true);
    }
  }, []);

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
    void handleWalletSetupReady();
  }, [
    handleWalletSetupReady,
    isReady,
    isWalletCreationReadyForReferralCheck,
    setupError,
  ]);

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
      variant="primary"
      size="large"
      onPress={handleLetsGo}
      iconAfter="ArrowRightOutline"
      {...(gtMd ? { minWidth: 240 } : { w: '100%' as const })}
    >
      {intl.formatMessage({ id: ETranslations.enter_wallet })}
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
