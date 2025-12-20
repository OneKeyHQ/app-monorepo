import type { ReactNode, RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import type { IInputRef, ITextAreaInputProps } from '@onekeyhq/components';
import {
  Button,
  HeightTransition,
  Icon,
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
import { fixInputImportSingleChain } from '../../Onboarding/pages/ImportWallet/ImportSingleChainBase';
import useScanQrCode from '../../ScanQrCode/hooks/useScanQrCode';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';
import type { RouteProp } from '@react-navigation/core';
import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputSelectionChangeEventData,
} from 'react-native';

function PrivateKeyInput({ value = '', onChangeText }: ITextAreaInputProps) {
  const intl = useIntl();
  const [privateKey, setPrivateKey] = useState(value);
  const { start: startScanQrCode } = useScanQrCode();
  const [encrypted, setEncrypted] = useState(true);
  const inputRef = useRef<IInputRef>(null);

  const privateKeyRef = useRef(privateKey);
  privateKeyRef.current = privateKey;
  const selectionRef = useRef({ start: 0, end: 0 });

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const selection = e.nativeEvent.selection;
      console.log('handleSelectionChange', selection);
      selectionRef.current = selection;
    },
    [],
  );

  const formattedValue = useMemo(() => {
    if (encrypted) {
      return '•'.repeat(privateKey.length);
    }
    return privateKey;
  }, [encrypted, privateKey]);

  const updatePrivateKey = useCallback(
    (text: string) => {
      setPrivateKey(text);
      onChangeText?.(text);
    },
    [onChangeText],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (encrypted) {
        // Find non-asterisk characters in text and merge with actual privateKey
        const selection = selectionRef.current;
        let newPrivateKey = privateKeyRef.current;

        // Calculate the difference between old and new text
        const oldLength = privateKeyRef.current.length;
        const newLength = text.length;

        const selectionRange = selection.end - selection.start;

        if (selectionRange > 0) {
          // Text was selected and replaced - replace selected characters with new text
          const selectedText = text
            .slice(selection.start, selection.end)
            .replace(/•/g, '');
          newPrivateKey =
            privateKeyRef.current.slice(0, selection.start) +
            selectedText +
            privateKeyRef.current.slice(selection.end);
        } else if (newLength > oldLength) {
          // Text was added - insert new characters at selection position
          const addedText = text.slice(
            selection.start,
            selection.start + (newLength - oldLength),
          );
          newPrivateKey =
            privateKeyRef.current.slice(0, selection.start) +
            addedText +
            privateKeyRef.current.slice(selection.start);
        } else if (newLength < oldLength) {
          // Text was removed - remove characters from selection position
          const removedCount = oldLength - newLength;
          const selectionStart = selection.start - 1;
          newPrivateKey =
            privateKeyRef.current.slice(0, selectionStart) +
            privateKeyRef.current.slice(selectionStart + removedCount);
        } else {
          // Text was replaced - replace characters at selection position
          const replacedText = text.slice(selection.start, selection.end);
          newPrivateKey =
            privateKeyRef.current.slice(0, selection.start) +
            replacedText +
            privateKeyRef.current.slice(selection.end);
        }

        updatePrivateKey(newPrivateKey);
      } else {
        updatePrivateKey(text);
      }
    },
    [encrypted, updatePrivateKey],
  );

  return (
    <TextAreaInput
      ref={inputRef as RefObject<TextInput>}
      allowPaste
      // allowClear
      allowScan
      allowSecureTextEye // TextAreaInput not support allowSecureTextEye
      onSelectionChange={handleSelectionChange}
      clearClipboardOnPaste
      onSecureTextEntryChange={setEncrypted}
      startScanQrCode={startScanQrCode}
      size="large"
      numberOfLines={5}
      value={formattedValue}
      onChangeText={handleChangeText}
      $platform-native={{
        minHeight: 160,
      }}
      placeholder={intl.formatMessage({
        id: ETranslations.form_enter_private_key_placeholder,
      })}
    />
  );
}

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
                  <PrivateKeyInput
                    value={privateKey}
                    onChangeText={setPrivateKey}
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
