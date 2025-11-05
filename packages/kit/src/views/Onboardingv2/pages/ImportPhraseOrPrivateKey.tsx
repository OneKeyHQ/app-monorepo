import { useCallback, useMemo, useState } from 'react';

import { compact, range } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  HeightTransition,
  Icon,
  Page,
  SegmentControl,
  Select,
  SizableText,
  TextAreaInput,
  XStack,
  YStack,
  useForm,
  useKeyboardEvent,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useRecoveryPhraseProtected from '@onekeyhq/kit/src/hooks/useRecoveryPhraseProtected';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInput } from '../components/PhaseInputArea';
import { PHRASE_LENGTHS, useSuggestion } from '../components/useSuggestion';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');
  const { gtMd } = useMedia();

  // Phrase input state
  const phraseLengths = PHRASE_LENGTHS;
  const phraseLengthOptions = phraseLengths.map((length) => ({
    label: intl.formatMessage({ id: ETranslations.count_words }, { length }),
    value: `${length}`,
  }));

  const [phraseLength, setPhraseLength] = useState(
    phraseLengthOptions[0].value,
  );
  const phraseLengthNumber = Number(phraseLength);
  const { serviceAccount, servicePassword } = backgroundApiProxy;
  const defaultPhrasesMap = useMemo(() => {
    const map: Record<string, string> = {};
    range(0, phraseLengthNumber)?.forEach((_, i) => {
      map[`phrase${i + 1}`] = '';
    });
    return map;
  }, [phraseLengthNumber]);
  const form = useForm({
    defaultValues: defaultPhrasesMap,
  });

  const invalidWordsLength = 0;
  const invalidPhrase = false;
  const invalidWordsMessage = (length: number) => {
    if (length === 1) {
      return '1 invalid word';
    }
    return `${length} invalid words`;
  };

  const handlePhraseConfirm = useCallback(async () => {
    const mnemonic: string = Object.values(form.getValues()).join(' ');
    const mnemonicEncoded = await servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    const { mnemonicType } = await serviceAccount.validateMnemonic(
      mnemonicEncoded,
    );
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
      mnemonic: mnemonicEncoded,
      mnemonicType,
    });
  }, [form, navigation, serviceAccount, servicePassword]);

  const {
    updateInputValue,
    onInputFocus,
    onInputBlur,
    onInputChange,
    suggestionsRef,
    openStatusRef,
    selectInputIndex,
    closePopover,
    focusNextInput,
    onPasteMnemonic,
    isShowErrors,
  } = useSuggestion(form, phraseLengthNumber, {
    setPhraseLength,
  });

  const handleReturnKeyPressed = useCallback(
    (index: number) => {
      if (index === phraseLengthNumber - 1) {
        void handlePhraseConfirm();
      } else {
        void focusNextInput();
      }
    },
    [focusNextInput, handlePhraseConfirm, phraseLengthNumber],
  );

  useKeyboardEvent({
    keyboardWillHide: closePopover,
  });

  const getReturnKeyLabel = useCallback(
    (index: number) =>
      index === phraseLengthNumber - 1 ||
      compact(Object.values(form.getValues())).length === phraseLengthNumber
        ? 'done'
        : 'next',
    [form, phraseLengthNumber],
  );

  const handleClear = useCallback(() => {
    Object.entries(defaultPhrasesMap).forEach(([key, value]) => {
      form.setValue(key, value);
    });
  }, [defaultPhrasesMap, form]);

  const handleChangePhraseLength = useCallback(
    (value: string) => {
      setPhraseLength(value);
      handleClear();
    },
    [handleClear],
  );

  useRecoveryPhraseProtected();

  const handleConfirm = useCallback(() => {
    if (selected === 'phrase') {
      void handlePhraseConfirm();
    } else {
      void navigation.push(EOnboardingPagesV2.SelectPrivateKeyNetwork, {
        privateKey: '',
      });
    }
  }, [selected, handlePhraseConfirm, navigation]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Import Phrase or Private Key" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent gap="$5">
            <SegmentControl
              value={selected}
              fullWidth
              options={[
                { label: 'Recovery phrase', value: 'phrase' },
                { label: 'Private Key', value: 'privateKey' },
              ]}
              onChange={(value) =>
                setSelected(value as 'phrase' | 'privateKey')
              }
            />
            <HeightTransition>
              {selected === 'phrase' ? (
                <YStack
                  key="phrase"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                  gap="$5"
                >
                  <XStack justifyContent="space-between">
                    <Select
                      title={intl.formatMessage({
                        id: ETranslations.select_recovery_phrase_length,
                      })}
                      placement="bottom-start"
                      items={phraseLengthOptions}
                      value={phraseLength}
                      onChange={handleChangePhraseLength}
                      renderTrigger={({ value }) => (
                        <Button
                          iconAfter="ChevronDownSmallOutline"
                          size="small"
                          variant="tertiary"
                          testID="phrase-length"
                        >
                          {intl.formatMessage(
                            { id: ETranslations.count_words },
                            {
                              length: value,
                            },
                          )}
                        </Button>
                      )}
                    />
                    <Button
                      icon="BroomOutline"
                      size="small"
                      variant="tertiary"
                      onPress={handleClear}
                      testID="clear-all"
                    >
                      {intl.formatMessage({ id: ETranslations.global_clear })}
                    </Button>
                  </XStack>
                  <Form form={form}>
                    <XStack flexWrap="wrap" m="$-1">
                      {Array.from({ length: phraseLengthNumber }).map(
                        (_, index) => (
                          <YStack key={index} flexBasis="50%" p="$1">
                            <Form.Field name={`phrase${index + 1}`}>
                              <PhaseInput
                                index={index}
                                isShowError={isShowErrors[index]}
                                onInputBlur={onInputBlur}
                                phraseLength={phraseLengthNumber}
                                onInputChange={onInputChange}
                                onInputFocus={onInputFocus}
                                onPasteMnemonic={onPasteMnemonic}
                                suggestionsRef={suggestionsRef}
                                updateInputValue={updateInputValue}
                                openStatusRef={openStatusRef}
                                selectInputIndex={selectInputIndex}
                                closePopover={closePopover}
                                onReturnKeyPressed={handleReturnKeyPressed}
                                getReturnKeyLabel={getReturnKeyLabel}
                                testID={`phrase-input-index${index}`}
                              />
                            </Form.Field>
                          </YStack>
                        ),
                      )}
                    </XStack>
                  </Form>

                  <HeightTransition>
                    {invalidWordsLength > 0 ? (
                      <XStack pt="$1.5" key="invalidWord">
                        <Icon
                          name="XCircleOutline"
                          size="$5"
                          color="$iconCritical"
                        />
                        <SizableText
                          size="$bodyMd"
                          color="$textCritical"
                          pl="$2"
                        >
                          {invalidWordsMessage(invalidWordsLength)}
                        </SizableText>
                      </XStack>
                    ) : null}
                    {invalidPhrase ? (
                      <XStack pt="$1.5" key="invalidPhrase">
                        <Icon
                          name="XCircleOutline"
                          size="$5"
                          color="$iconCritical"
                        />
                        <SizableText
                          size="$bodyMd"
                          color="$textCritical"
                          pl="$2"
                        >
                          {intl.formatMessage({
                            id: ETranslations.feedback_invalid_phrases,
                          })}
                        </SizableText>
                      </XStack>
                    ) : null}
                  </HeightTransition>
                </YStack>
              ) : (
                <YStack
                  key="privateKey"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                  gap="$5"
                >
                  <TextAreaInput
                    size="large"
                    numberOfLines={5}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder="Enter your private key"
                  />
                </YStack>
              )}
            </HeightTransition>
            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleConfirm}>
                Continue
              </Button>
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <Button
              size="large"
              variant="primary"
              onPress={handleConfirm}
              w="100%"
            >
              Confirm
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
