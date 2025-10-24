import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { range } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  HeightTransition,
  Page,
  ScrollView,
  Select,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { InteractiveDotWord } from '@onekeyhq/kit/src/components/DotMap';
import { dotMapValueToWord } from '@onekeyhq/kit/src/components/DotMap/utils';
import useRecoveryPhraseProtected from '@onekeyhq/kit/src/hooks/useRecoveryPhraseProtected';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';

import { PHRASE_LENGTHS } from './hooks';
import { PhaseInputArea } from './PhaseInputArea';

function DotMapInputContent({
  onConfirm,
  FooterComponent,
  showPhraseLengthSelector,
  showClearAllButton,
  phraseLength,
  phraseLengthNumber,
  phraseLengthOptions,
  setPhraseLength,
  onSwitchToText,
}: {
  onConfirm: (params: {
    mnemonic: string;
    mnemonicType: EMnemonicType;
  }) => void;
  FooterComponent?: ReactElement;
  showPhraseLengthSelector: boolean;
  showClearAllButton: boolean;
  phraseLength: string;
  phraseLengthNumber: number;
  phraseLengthOptions: Array<{ label: string; value: string }>;
  setPhraseLength: (value: string) => void;
  onSwitchToText: () => void;
}) {
  const intl = useIntl();
  const { serviceAccount, servicePassword } = backgroundApiProxy;

  // Store dot values as binary strings (12 chars of '0' or '1')
  const defaultDotValues = useMemo(() => {
    const map: Record<string, string> = {};
    range(0, phraseLengthNumber)?.forEach((_, i) => {
      map[`phrase${i + 1}`] = '000000000000'; // 12 zeros
    });
    return map;
  }, [phraseLengthNumber]);

  const form = useForm({
    defaultValues: defaultDotValues,
  });

  const handlePageFooterConfirm = useCallback(async () => {
    const dotValues = form.getValues();
    const words: string[] = [];

    // Convert dot values to words
    for (let i = 0; i < phraseLengthNumber; i += 1) {
      const key = `phrase${i + 1}`;
      const binaryString = dotValues[key];
      const boolArray = binaryString.split('').map((c) => c === '1');
      const word = dotMapValueToWord(boolArray);
      if (!word) {
        // Invalid or incomplete word
        return;
      }
      words.push(word);
    }

    const mnemonic = words.join(' ');
    const mnemonicEncoded = await servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    const { mnemonicType } = await serviceAccount.validateMnemonic(
      mnemonicEncoded,
    );
    onConfirm({ mnemonic: mnemonicEncoded, mnemonicType });
  }, [form, onConfirm, phraseLengthNumber, serviceAccount, servicePassword]);

  const handleToggleDot = useCallback(
    (wordIndex: number, dotIndex: number) => {
      const key = `phrase${wordIndex + 1}`;
      const currentValue = form.getValues(key);
      const bits = currentValue.split('');
      bits[dotIndex] = bits[dotIndex] === '1' ? '0' : '1';
      const newValue = bits.join('');
      form.setValue(key, newValue);
    },
    [form],
  );

  const handleClear = useCallback(() => {
    Object.entries(defaultDotValues).forEach(([key, value]) => {
      form.setValue(key, value);
    });
  }, [defaultDotValues, form]);

  const handleChangePhraseLength = useCallback(
    (value: string) => {
      setPhraseLength(value);
      handleClear();
    },
    [handleClear, setPhraseLength],
  );

  useRecoveryPhraseProtected();

  return (
    <>
      <Page.Body>
        {showPhraseLengthSelector || showClearAllButton ? (
          <XStack px="$5" pb="$2" pt="$2" justifyContent="space-between">
            {showPhraseLengthSelector ? (
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
            ) : null}
            {showClearAllButton ? (
              <Button
                icon="BroomOutline"
                size="small"
                variant="tertiary"
                onPress={handleClear}
                testID="clear-all"
              >
                {intl.formatMessage({ id: ETranslations.global_clear })}
              </Button>
            ) : null}
          </XStack>
        ) : null}

        <ScrollView>
          <YStack alignItems="center">
            <Form form={form}>
              <YStack px="$4" py="$2">
                {Array.from({ length: phraseLengthNumber }).map((_, index) => {
                  const key = `phrase${index + 1}`;
                  const binaryString = form.watch(key) || '000000000000';
                  const boolArray = binaryString
                    .split('')
                    .map((c) => c === '1');

                  return (
                    <Form.Field key={index} name={key}>
                      <InteractiveDotWord
                        values={boolArray}
                        onToggle={(dotIndex) => {
                          handleToggleDot(index, dotIndex);
                        }}
                        wordIndex={index + 1}
                        showWord={false}
                      />
                    </Form.Field>
                  );
                })}
              </YStack>
            </Form>
          </YStack>
        </ScrollView>

        <HeightTransition>
          <XStack px="$5" py="$3" justifyContent="center">
            <Button
              icon="EditOutline"
              size="small"
              variant="tertiary"
              onPress={onSwitchToText}
            >
              Switch to Text Input
            </Button>
          </XStack>
        </HeightTransition>

        {FooterComponent}
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_continue,
          })}
          confirmButtonProps={{
            onPress: handlePageFooterConfirm,
          }}
        />
      </Page.Footer>
    </>
  );
}

export function DotMapInputArea({
  onConfirm,
  FooterComponent,
  showPhraseLengthSelector = true,
  showClearAllButton = true,
  defaultPhrases = [],
}: {
  onConfirm: (params: {
    mnemonic: string;
    mnemonicType: EMnemonicType;
  }) => void;
  showPhraseLengthSelector?: boolean;
  showClearAllButton?: boolean;
  FooterComponent?: ReactElement;
  defaultPhrases?: string[];
}) {
  const intl = useIntl();
  const [inputMode, setInputMode] = useState<'dotmap' | 'text'>('dotmap');

  const phraseLengths = PHRASE_LENGTHS;
  const phraseLengthOptions = phraseLengths.map((length) => ({
    label: intl.formatMessage({ id: ETranslations.count_words }, { length }),
    value: `${length}`,
  }));

  const [phraseLength, setPhraseLength] = useState(
    phraseLengthOptions[0].value,
  );
  const phraseLengthNumber = Number(phraseLength);

  // If text mode is enabled, delegate to PhaseInputArea
  if (inputMode === 'text') {
    return (
      <PhaseInputArea
        onConfirm={onConfirm}
        FooterComponent={
          <>
            <XStack px="$5" py="$3" justifyContent="center">
              <Button
                icon="QrCodeOutline"
                size="small"
                variant="tertiary"
                onPress={() => {
                  setInputMode('dotmap');
                }}
              >
                Switch to DotMap
              </Button>
            </XStack>
            {FooterComponent}
          </>
        }
        showPhraseLengthSelector={showPhraseLengthSelector}
        showClearAllButton={showClearAllButton}
        defaultPhrases={defaultPhrases}
      />
    );
  }

  // Dotmap mode
  return (
    <DotMapInputContent
      onConfirm={onConfirm}
      FooterComponent={FooterComponent}
      showPhraseLengthSelector={showPhraseLengthSelector}
      showClearAllButton={showClearAllButton}
      phraseLength={phraseLength}
      phraseLengthNumber={phraseLengthNumber}
      phraseLengthOptions={phraseLengthOptions}
      setPhraseLength={setPhraseLength}
      onSwitchToText={() => {
        setInputMode('text');
      }}
    />
  );
}
