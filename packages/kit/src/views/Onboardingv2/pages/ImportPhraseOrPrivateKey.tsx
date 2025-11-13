import type { ReactNode, RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import {
  Button,
  HeightTransition,
  Icon,
  Input,
  Page,
  Portal,
  SegmentControl,
  SizableText,
  TextAreaInput,
  XStack,
  YStack,
  useMedia,
  useReanimatedKeyboardAnimation,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2ImportPhraseOrPrivateKeyTab,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { fixInputImportSingleChain } from '../../Onboarding/pages/ImportWallet/ImportSingleChainBase';
import useScanQrCode from '../../ScanQrCode/hooks/useScanQrCode';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';
import type { RouteProp } from '@react-navigation/core';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const routeParams =
    useRoute<
      RouteProp<
        IOnboardingParamListV2,
        EOnboardingPagesV2.ImportPhraseOrPrivateKey
      >
    >();
  const { defaultTab = EOnboardingV2ImportPhraseOrPrivateKeyTab.Phrase } =
    routeParams.params || {};
  const [selected, setSelected] =
    useState<EOnboardingV2ImportPhraseOrPrivateKeyTab>(defaultTab);
  const { gtMd } = useMedia();
  const phaseInputAreaRef = useRef<IPhaseInputAreaInstance | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const intl = useIntl();
  const [privateKey, setPrivateKey] = useState('');

  const handleConfirm = async () => {
    if (selected === EOnboardingV2ImportPhraseOrPrivateKeyTab.Phrase) {
      const timerId = setTimeout(() => {
        setIsConfirming(false);
      }, 500);
      setIsConfirming(true);
      if (phaseInputAreaRef.current) {
        try {
          const { mnemonic, mnemonicType } =
            await phaseInputAreaRef.current.submit();
          navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
            mnemonic,
            mnemonicType,
            isWalletBackedUp: true,
          });
        } catch (error) {
          console.error(error);
        } finally {
          setIsConfirming(false);
          clearTimeout(timerId);
        }
      }
    } else {
      let input = fixInputImportSingleChain(privateKey || '') || '';
      input = await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: input || '',
      });
      const results =
        await backgroundApiProxy.serviceNetwork.detectNetworksByPrivateKey({
          privateKey: input || '',
        });
      const params: IOnboardingParamListV2[EOnboardingPagesV2.SelectPrivateKeyNetwork] =
        {
          input,
          detectedNetworks: results.detectedNetworks,
          importType: EOnboardingV2ImportPhraseOrPrivateKeyTab.PrivateKey,
        };
      navigation.push(EOnboardingPagesV2.SelectPrivateKeyNetwork, params);
      setPrivateKey('');
    }
  };

  const { height } = useReanimatedKeyboardAnimation();
  const keyboardHeight = useSharedValue<number>(0);

  useAnimatedReaction(
    () => height.get(),
    (value) => {
      const v = Math.abs(value);
      keyboardHeight.value = v;
    },
  );

  const renderHardwarePhrasesWarningTag = useCallback(
    (chunks: ReactNode[]) => (
      <SizableText
        onPress={() => navigation.push(EOnboardingPagesV2.PickYourDevice)}
        color="$textCautionStrong"
        size="$bodyMdMedium"
        hitSlop={{
          top: 8,
          left: 8,
          right: 8,
          bottom: 8,
        }}
        cursor="default"
        hoverStyle={{
          color: '$textCaution',
        }}
      >
        {chunks}
      </SizableText>
    ),
    [navigation],
  );

  const { start: startScanQrCode } = useScanQrCode();

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.import_phrase_or_private_key,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent gap="$5">
            <SegmentControl
              value={selected}
              fullWidth
              options={[
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_recovery_phrase,
                  }),
                  value: EOnboardingV2ImportPhraseOrPrivateKeyTab.Phrase,
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_private_key,
                  }),
                  value: EOnboardingV2ImportPhraseOrPrivateKeyTab.PrivateKey,
                },
              ]}
              onChange={(value) =>
                setSelected(value as EOnboardingV2ImportPhraseOrPrivateKeyTab)
              }
            />
            <HeightTransition>
              {selected === EOnboardingV2ImportPhraseOrPrivateKeyTab.Phrase ? (
                <YStack gap="$3">
                  <XStack
                    px="$2"
                    py="$1"
                    borderWidth={StyleSheet.hairlineWidth}
                    borderColor="$borderCautionSubdued"
                    borderRadius="$3"
                    borderCurve="continuous"
                    bg="$bgCautionSubdued"
                    gap="$2"
                  >
                    <YStack flexShrink={0} py={2}>
                      <Icon
                        name="ErrorOutline"
                        size="$4"
                        color="$iconCaution"
                      />
                    </YStack>
                    <SizableText color="$textCaution" flex={1}>
                      {intl.formatMessage(
                        {
                          id: ETranslations.import_hardware_phrases_warning,
                        },
                        {
                          tag: renderHardwarePhrasesWarningTag,
                        },
                      )}
                    </SizableText>
                  </XStack>
                  <PhaseInputArea
                    ref={
                      phaseInputAreaRef as RefObject<IPhaseInputAreaInstance>
                    }
                    defaultPhrases={[]}
                  />
                </YStack>
              ) : (
                <YStack
                  key="privateKey"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                    filter: 'blur(4px)',
                  }}
                  gap="$5"
                >
                  <Input
                    allowPaste
                    allowClear
                    allowScan
                    allowSecureTextEye // TextAreaInput not support allowSecureTextEye
                    clearClipboardOnPaste
                    startScanQrCode={startScanQrCode}
                    size="large"
                    numberOfLines={5}
                    value={privateKey}
                    onChangeText={setPrivateKey}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder={intl.formatMessage({
                      id: ETranslations.form_enter_private_key_placeholder,
                    })}
                  />
                </YStack>
              )}
            </HeightTransition>
            <Animated.View
              style={{
                height: keyboardHeight,
              }}
            />
            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleConfirm}>
                {intl.formatMessage({ id: ETranslations.global_confirm })}
              </Button>
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <YStack>
              <Animated.View style={{ transform: [{ translateY: height }] }}>
                <YStack>
                  <XStack
                    bg="$bgApp"
                    alignItems="center"
                    justifyContent="center"
                    pt="$5"
                  >
                    <YStack w="100%">
                      {platformEnv.isNative ? (
                        <XStack onPress={noop}>
                          <Portal.Container
                            name={Portal.Constant.SUGGESTION_LIST}
                          />
                        </XStack>
                      ) : null}
                      <Button
                        size="large"
                        variant="primary"
                        onPress={handleConfirm}
                        loading={isConfirming}
                        w="100%"
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_confirm,
                        })}
                      </Button>
                    </YStack>
                  </XStack>
                </YStack>
              </Animated.View>
            </YStack>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
