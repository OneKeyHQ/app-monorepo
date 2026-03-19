import type { ReactNode, RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { IInputRef, ITextAreaInputProps } from '@onekeyhq/components';
import {
  Button,
  HeightTransition,
  Icon,
  Page,
  Portal,
  SegmentControl,
  SizableText,
  Stack,
  TextAreaInput,
  XStack,
  YStack,
  useKeyboardEvent,
  useMedia,
  useReanimatedKeyboardAnimation,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import type { IQRCodeHandlerParseOutsideOptions } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
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
  const encryptedRef = useRef(encrypted);
  encryptedRef.current = encrypted;

  const privateKeyRef = useRef(privateKey);
  privateKeyRef.current = privateKey;
  const selectionRef = useRef({ start: 0, end: 0 });

  // Wrap startScanQrCode to force native TextInput refresh after scan.
  // On native, controlled TextInput may not visually update after modal
  // dismiss. setNativeProps forces the native view to sync with React state.
  const wrappedStartScanQrCode = useCallback(
    async (params: IQRCodeHandlerParseOutsideOptions) => {
      const result = await startScanQrCode(params);
      if (result?.raw && platformEnv.isNative) {
        requestAnimationFrame(() => {
          const displayText = encryptedRef.current
            ? '•'.repeat(result.raw.length)
            : result.raw;
          inputRef.current?.setNativeProps?.({ text: displayText });
        });
      }
      return result;
    },
    [startScanQrCode],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
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
      // Update ref immediately so subsequent onChangeText calls
      // (before re-render) see the latest value
      privateKeyRef.current = text;
      setPrivateKey(text);
      onChangeText?.(text);
    },
    [onChangeText],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (encrypted) {
        // Bulk replacement (scan / paste via addon): the text contains no '•'
        // characters, so it was injected programmatically rather than typed.
        if (!text.includes('•')) {
          updatePrivateKey(text);
          return;
        }

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
          // Same length - no change needed
          return;
        }

        updatePrivateKey(newPrivateKey);
      } else {
        updatePrivateKey(text);
      }
    },
    [encrypted, updatePrivateKey],
  );

  // Custom eye toggle addon - avoids native secureTextEntry which conflicts
  // with manual '•' masking on multiline TextArea inputs
  const eyeToggleAddOn = useMemo(
    () => [
      {
        iconName: (encrypted ? 'EyeOffOutline' : 'EyeOutline') as IKeyOfIcons,
        onPress: () => setEncrypted((v) => !v),
      },
    ],
    [encrypted],
  );

  return (
    <TextAreaInput
      ref={inputRef as RefObject<TextInput>}
      allowPaste
      allowScan
      addOns={eyeToggleAddOn}
      onSelectionChange={handleSelectionChange}
      clearClipboardOnPaste
      startScanQrCode={wrappedStartScanQrCode}
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
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(
    selected === EOnboardingV2ImportPhraseOrPrivateKeyTab.Phrase,
  );
  useKeyboardEvent({
    keyboardWillShow: () => setIsKeyboardVisible(true),
    keyboardWillHide: () => setIsKeyboardVisible(false),
  });

  // The root layout adds pb: safeAreaBottom + 10 which creates a gap below
  // the footer when keyboard is up. Compensate by translating down half that
  // distance so the footer content is vertically centered.
  const rootBottomPadding = safeAreaBottom + 10;
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: height.value < 0 ? height.value + rootBottomPadding / 2 : 0,
      },
    ],
  }));

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

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.import_phrase_or_private_key,
          })}
        />
        <OnboardingLayout.Body constrained={false} bottomOffset={200}>
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
            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleConfirm}>
                {intl.formatMessage({ id: ETranslations.global_confirm })}
              </Button>
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            {platformEnv.isNative ? (
              <YStack>
                <Animated.View style={footerAnimatedStyle}>
                  <YStack>
                    {isKeyboardVisible ? (
                      <Stack
                        mx="$-5"
                        borderTopWidth={StyleSheet.hairlineWidth}
                        borderColor="$borderSubdued"
                      />
                    ) : null}
                    <XStack
                      bg="$bgApp"
                      alignItems="center"
                      justifyContent="center"
                      pt="$3"
                      pb={500}
                      mb={-500}
                    >
                      <YStack w="100%" gap="$3">
                        <HeightTransition>
                          <XStack onPress={noop}>
                            <Portal.Container
                              name={Portal.Constant.SUGGESTION_LIST}
                            />
                          </XStack>
                        </HeightTransition>
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
            ) : (
              <YStack w="100%" pb="$5">
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
            )}
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
