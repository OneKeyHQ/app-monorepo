import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Divider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingPage } from '../components/Layout';
import { SetupCard, SetupCardBody } from '../components/SetupCard';
import { makeSequencedFade } from '../components/setupMotion';
import { SetupStatusCard } from '../components/SetupStatusCard';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';
import { OnboardingTestIDs } from '../testIDs';
import { getForceTransportType } from '../utils';

import {
  MOCK_INITIAL_STATUS,
  Pro2MockDevPanel,
  Pro2OnboardingStepper,
  mockStatusToPhase,
  supportsDeviceDrivenOnboarding,
} from './deviceSetupPro2Mock';

import type { SearchDevice } from '@onekeyfe/hd-core';

// The real-device check states. Maps onto the same three macro phases
// (checking / needsSetup / ready) the device-driven (Pro 2) path uses.
enum EDeviceSetupState {
  Checking = 'checking',
  NeedSetup = 'needSetup',
  Error = 'error',
  Success = 'success',
}

// Macro-phase swap (checking → stepper → ready): a sequenced ("mode=wait")
// opacity fade — see makeSequencedFade. Cross-fading these dissimilar blocks (a
// small status card vs. the tall stepper) would ghost two shapes through each
// other; clearing the stage first reads cleaner for a milestone moment.
const { entering: PHASE_ENTER, exiting: PHASE_EXIT } = makeSequencedFade({
  enterMs: 240,
  exitMs: 180,
});

function DeviceSetupPage({
  route,
}: IPageScreenProps<IOnboardingParamListV2, EOnboardingPagesV2.DeviceSetup>) {
  const intl = useIntl();
  const { deviceData, tabValue, isFirmwareVerified } = route?.params ?? {};
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();

  // Device-driven onboarding (Pro 2 today; Pro after its firmware migrates).
  // MOCK: the device can't connect, so this path runs a local mock status
  // machine driven by a dev panel instead of the real check below.
  const isDeviceDriven = supportsDeviceDrivenOnboarding(
    deviceData?.device as SearchDevice | undefined,
  );
  const [mockStatus, setMockStatus] = useState(MOCK_INITIAL_STATUS);

  const [currentDevice, setCurrentDevice] = useState<SearchDevice | undefined>(
    deviceData?.device as SearchDevice | undefined,
  );
  const [setupState, setSetupState] = useState<EDeviceSetupState>(
    EDeviceSetupState.Checking,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  // Pending "jump to FinalizeWalletSetup" timer for the already-initialized
  // path; cleared on unmount so a back-press mid-flash cannot navigate after
  // this page is gone.
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getActiveDevice } = useDeviceConnect({ setCurrentDevice });

  const ensureTransportType = useCallback(async () => {
    if (!tabValue) {
      return;
    }
    const forceTransportType = await getForceTransportType(tabValue);
    if (forceTransportType) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType,
      });
    }
  }, [tabValue]);

  // Legacy fallback instructions, shown for devices without the device-driven
  // onboarding protocol (Pro / Classic / Mini / Touch).
  const DEVICE_SETUP_INSTRUCTIONS = useMemo(() => {
    const deviceType = (currentDevice as SearchDevice)?.deviceType;
    const isClassicOrMini =
      deviceType === EDeviceType.Classic ||
      deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure ||
      deviceType === EDeviceType.Mini;

    const chooseOptionStep = {
      title: intl.formatMessage({
        id: ETranslations.setup_choose_option_title,
      }),
      details: [
        intl.formatMessage({
          id: ETranslations.setup_choose_option_create_new_wallet,
        }),
        intl.formatMessage({
          id: ETranslations.setup_choose_option_import_wallet,
        }),
      ],
    };

    const pinStep = {
      title: intl.formatMessage({ id: ETranslations.setup_pin }),
      details: [
        intl.formatMessage({ id: ETranslations.setup_pin_limit }),
        intl.formatMessage({ id: ETranslations.setup_pin_reminder }),
      ],
    };

    const recoveryPhraseStep = {
      title: intl.formatMessage({ id: ETranslations.setup_recovery_phrase }),
      details: [
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_write_down,
        }),
        intl.formatMessage({ id: ETranslations.setup_recovery_phrase_matches }),
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_charging,
        }),
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_do_not_power_off,
        }),
      ],
    };

    const finishOnboardingOnDevice = {
      title: intl.formatMessage({
        id: ETranslations.setup_recovery_phrase_follow_instructions,
      }),
      details: [] as string[],
    };

    // For Classic or Mini devices, swap the order of PIN and recovery phrase
    if (isClassicOrMini) {
      return [
        chooseOptionStep,
        recoveryPhraseStep,
        pinStep,
        finishOnboardingOnDevice,
      ];
    }

    return [
      chooseOptionStep,
      pinStep,
      recoveryPhraseStep,
      finishOnboardingOnDevice,
    ];
  }, [intl, currentDevice]);

  const checkDeviceInitialized = useCallback(async () => {
    setErrorMessage(undefined);
    setSetupState(EDeviceSetupState.Checking);
    try {
      await ensureTransportType();
      const baseDevice =
        getActiveDevice() ??
        currentDevice ??
        (deviceData?.device as SearchDevice | undefined);
      if (!baseDevice) {
        setSetupState(EDeviceSetupState.NeedSetup);
        return;
      }
      const latestDevice = getActiveDevice() ?? baseDevice;
      setCurrentDevice(latestDevice);
      if (latestDevice.connectId) {
        const [features] = await Promise.all([
          backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
            connectId: latestDevice.connectId,
          }),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 1200);
          }),
        ]);
        const deviceMode = await deviceUtils.getDeviceModeFromFeatures({
          features,
        });
        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          setSetupState(EDeviceSetupState.NeedSetup);
          return;
        }
      } else {
        setSetupState(EDeviceSetupState.NeedSetup);
        return;
      }
    } catch {
      // A failed status read falls back to the on-device setup instructions
      // (the user can re-trigger via Done once the device responds). Hard
      // connection/permission errors surface separately via useConnectDeviceError.
      setSetupState(EDeviceSetupState.NeedSetup);
      return;
    }
    setSetupState(EDeviceSetupState.Success);
    const deviceForFinalize =
      getActiveDevice() ??
      currentDevice ??
      (deviceData?.device as SearchDevice | undefined);
    navigateTimeoutRef.current = setTimeout(() => {
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData: {
          ...deviceData,
          device: (deviceForFinalize ?? currentDevice) as SearchDevice,
        },
        isFirmwareVerified,
      });
    }, 1200);
  }, [
    ensureTransportType,
    getActiveDevice,
    currentDevice,
    deviceData,
    navigation,
    isFirmwareVerified,
  ]);

  const handleDeviceSetupDone = useCallback(() => {
    void checkDeviceInitialized();
  }, [checkDeviceInitialized]);

  // Run the real device-status check on mount — only for the real-device path.
  // The device-driven (mock Pro 2) path is driven by the dev panel instead.
  useEffect(() => {
    if (isDeviceDriven) {
      return undefined;
    }
    void checkDeviceInitialized();
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defense in depth: clear forceTransportType when this page is removed so an
  // abandoned onboarding cannot leak the forced transport into later
  // connections. Clearing is idempotent.
  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });
    return unsubscribe;
  }, [reactNavigation]);

  useConnectDeviceError(
    useCallback(
      (errorMessageId: ETranslations) => {
        setErrorMessage(intl.formatMessage({ id: errorMessageId }));
        setSetupState(EDeviceSetupState.Error);
      },
      [intl],
    ),
  );

  const mockPhase = mockStatusToPhase(mockStatus);

  const fallbackCard = (
    <SetupCard
      elevated
      title={intl.formatMessage({ id: ETranslations.set_up_your_device })}
    >
      <SetupCardBody gap="$5">
        <SizableText size="$bodyMdMedium" color="$textInfo">
          {intl.formatMessage({ id: ETranslations.setup_device_prompt })}
        </SizableText>
        {DEVICE_SETUP_INSTRUCTIONS.map((instruction, idx) => (
          <YStack key={instruction.title} gap="$5">
            <Divider />
            <YStack gap={instruction.details.length ? '$2' : undefined}>
              <XStack gap="$2">
                <YStack
                  w="$5"
                  h="$5"
                  borderRadius="$1"
                  borderCurve="continuous"
                  bg="$bgStrong"
                  alignItems="center"
                  justifyContent="center"
                >
                  <SizableText textAlign="center">{idx + 1}</SizableText>
                </YStack>
                <SizableText size="$bodyMdMedium" flex={1}>
                  {instruction.title}
                </SizableText>
              </XStack>
              {instruction.details.map((detail) => (
                <XStack key={detail} gap="$2">
                  <YStack
                    w="$5"
                    h="$5"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <YStack
                      w={5}
                      h={5}
                      borderRadius="$full"
                      bg="$iconDisabled"
                    />
                  </YStack>
                  <SizableText color="$textSubdued" flex={1}>
                    {detail}
                  </SizableText>
                </XStack>
              ))}
            </YStack>
          </YStack>
        ))}
        <Button
          testID={OnboardingTestIDs.deviceSetupDoneBtn}
          variant="primary"
          $platform-native={{ size: 'large' }}
          onPress={handleDeviceSetupDone}
        >
          {intl.formatMessage({ id: ETranslations.global_done })}
        </Button>
      </SetupCardBody>
    </SetupCard>
  );

  return (
    <OnboardingPage
      testID={OnboardingTestIDs.deviceSetupPage}
      headerTitle={intl.formatMessage({ id: ETranslations.set_up_your_device })}
      scrollable
      alignTop
      narrow
      contentContainerProps={{ gap: '$10' }}
    >
      {isDeviceDriven ? (
        <YStack>
          {/* Keyed on the phase so checking → stepper → ready cross-fades when
              the phase changes; the dev panel stays mounted (not faded). */}
          <Animated.View
            key={mockPhase}
            entering={PHASE_ENTER}
            exiting={PHASE_EXIT}
          >
            {mockPhase === 'checking' ? (
              <SetupStatusCard
                tone="checking"
                label={intl.formatMessage({
                  id: ETranslations.global_checking,
                })}
              />
            ) : null}
            {mockPhase === 'needsSetup' ? (
              <Pro2OnboardingStepper status={mockStatus} />
            ) : null}
            {mockPhase === 'ready' ? (
              <SetupStatusCard
                tone="ready"
                label={intl.formatMessage({
                  id: ETranslations.your_device_is_ready,
                })}
              />
            ) : null}
          </Animated.View>
          <Pro2MockDevPanel status={mockStatus} onChange={setMockStatus} />
        </YStack>
      ) : (
        <YStack>
          {/* Keyed on the state so checking → setup → ready/error cross-fades. */}
          <Animated.View
            key={setupState}
            entering={PHASE_ENTER}
            exiting={PHASE_EXIT}
          >
            {setupState === EDeviceSetupState.Checking ? (
              <SetupStatusCard
                tone="checking"
                label={intl.formatMessage({
                  id: ETranslations.global_checking,
                })}
              />
            ) : null}
            {setupState === EDeviceSetupState.NeedSetup ? fallbackCard : null}
            {setupState === EDeviceSetupState.Success ? (
              <SetupStatusCard
                tone="ready"
                label={intl.formatMessage({
                  id: ETranslations.your_device_is_ready,
                })}
              />
            ) : null}
            {setupState === EDeviceSetupState.Error ? (
              <XStack
                gap="$2"
                pt="$4"
                borderTopWidth={StyleSheet.hairlineWidth}
                borderTopColor="$borderSubdued"
                alignItems="center"
              >
                <SizableText
                  size="$bodyMdMedium"
                  color="$textCritical"
                  flex={1}
                  textAlign="left"
                >
                  {errorMessage ??
                    intl.formatMessage({
                      id: ETranslations.global_an_error_occurred,
                    })}
                </SizableText>
                <Button
                  testID={OnboardingTestIDs.deviceSetupRetryBtn}
                  variant="primary"
                  onPress={handleDeviceSetupDone}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              </XStack>
            ) : null}
          </Animated.View>
        </YStack>
      )}
    </OnboardingPage>
  );
}

export default function DeviceSetup({
  route,
  navigation,
}: IPageScreenProps<IOnboardingParamListV2, EOnboardingPagesV2.DeviceSetup>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <DeviceSetupPage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}
