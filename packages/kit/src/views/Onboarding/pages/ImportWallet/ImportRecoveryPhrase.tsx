import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { type View } from 'react-native';
import { findNodeHandle } from 'react-native';

import {
  Alert,
  Button,
  Dialog,
  Form,
  HeightTransition,
  Icon,
  Input,
  Page,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  useForm,
  useIsKeyboardShown,
  useKeyboardEvent,
  useMedia,
  usePage,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Tutorials } from '../../Components';

import { useSuggestion } from './hooks';

const useScrollToInputArea = (ref: RefObject<View>) => {
  const { pageRef, getContentOffset } = usePage();
  const scrollToInputArea = useCallback(() => {
    const refHandle = findNodeHandle(ref.current);
    if (ref.current && refHandle) {
      setTimeout(() => {
        ref.current?.measureLayout(refHandle, (left, top, width, height) => {
          if (getContentOffset().y < height) {
            pageRef?.scrollTo({ x: 0, y: top + height, animated: true });
          }
        });
      }, 300);
    }
  }, [getContentOffset, pageRef, ref]);
  useKeyboardEvent({
    keyboardWillShow: scrollToInputArea,
  });
  return {
    scrollToInputArea,
  };
};

const tutorials = [
  {
    title: 'What is a recovery phrase?',
    description:
      'It is a 12, 18 or 24-word phrase that can be used to restore your wallet.',
  },
  {
    title: 'Is it safe to enter it into OneKey?',
    description:
      'Yes. It will be stored locally and never leave your device without your explicit permission.',
  },
];

const phraseLengthOptions = [
  { label: '12 words', value: '12' },
  { label: '15 words', value: '15' },
  { label: '18 words', value: '18' },
  { label: '21 words', value: '21' },
  { label: '24 words', value: '24' },
];

interface IWordItemProps {
  word: string;
  onPress: (word: string) => void;
}

function WordItem({ word, onPress }: IWordItemProps) {
  const handlePress = useCallback(() => {
    onPress(word);
  }, [onPress, word]);
  return (
    <Stack
      bg="$backgroundHover"
      py="$1"
      px="$2"
      borderRadius="$2"
      mr="$4"
      onPress={handlePress}
    >
      <SizableText>{word}</SizableText>
    </Stack>
  );
}

function SuggestionList({
  suggestions,
  updateInputValue,
}: {
  suggestions: string[];
  updateInputValue: (text: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      keyboardDismissMode="none"
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{
        px: '$4',
        py: '$2',
      }}
      showsHorizontalScrollIndicator={false}
    >
      {suggestions.slice(0, 10).map((word) => (
        <WordItem key={word} word={word} onPress={updateInputValue} />
      ))}
    </ScrollView>
  );
}

function PageFooter({
  suggestions,
  updateInputValue,
}: {
  suggestions: string[];
  updateInputValue: (text: string) => void;
}) {
  const isShow = useIsKeyboardShown();
  return (
    <Page.Footer extraData={[isShow, suggestions]}>
      {isShow ? (
        <SuggestionList
          suggestions={suggestions}
          updateInputValue={updateInputValue}
        />
      ) : null}
      <Page.FooterActions onConfirm={() => console.log('confirm')} />
    </Page.Footer>
  );
}

function PhaseInput({
  index,
  onChange,
  value,
  onInputChange,
  onInputFocus,
  onInputBlur,
}: {
  value: string;
  index: number;
  onInputChange: (value: string) => string;
  onChange: (value: string) => void;
  onInputFocus: (index: number) => void;
  onInputBlur: (index: number) => void;
}) {
  const media = useMedia();
  const handleInputFocus = useCallback(() => {
    onInputFocus(index);
  }, [index, onInputFocus]);
  const handleInputBlur = useCallback(() => {
    onInputBlur(index);
  }, [index, onInputBlur]);

  const handleChangeText = useCallback(
    (v: string) => {
      const text = onInputChange(v);
      onChange(text);
    },
    [onChange, onInputChange],
  );

  if (platformEnv.isNative) {
    return (
      <Input
        value={value}
        autoCorrect={false}
        spellCheck={false}
        size={media.md ? 'large' : 'medium'}
        leftAddOnProps={{
          label: `${index + 1}`,
          minWidth: '$10',
          justifyContent: 'center',
        }}
        onChangeText={handleChangeText}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        returnKeyType="next"
      />
    );
  }
}

function PageContent() {
  const form = useForm({});
  const selectInputIndex = useRef(-1);
  const alertRef = useRef<View>(null);
  const [phraseLength, setPhraseLength] = useState(
    phraseLengthOptions[0].value,
  );

  const invalidWordsLength = 0;
  const invalidPhrase = false;
  const invalidWordsMessage = (length: number) => {
    if (length === 1) {
      return '1 invalid word';
    }
    return `${length} invalid words`;
  };

  useScrollToInputArea(alertRef);

  const {
    suggestions,
    updateInputValue,
    onInputFocus,
    onInputBlur,
    onInputChange,
  } = useSuggestion(form, selectInputIndex);

  const handleClear = useCallback(() => {
    form.reset();
  }, [form]);

  return (
    <>
      <Page.Body>
        <Stack ref={alertRef}>
          <Alert
            closable
            type="warning"
            fullBleed
            title='Do not import recovery phrase from hardware wallet. Go back and use "Connect Hardware Wallet" instead.'
            mb="$5"
          />
        </Stack>
        <XStack px="$5" pb="$2" justifyContent="space-between">
          <Select
            title="Select a length"
            placement="bottom-start"
            items={phraseLengthOptions}
            value={phraseLength}
            onChange={setPhraseLength}
            renderTrigger={({ value }) => (
              <Button
                iconAfter="ChevronDownSmallOutline"
                size="small"
                variant="tertiary"
              >
                {value} words
              </Button>
            )}
          />
          <Button
            icon="BroomOutline"
            size="small"
            variant="tertiary"
            onPress={handleClear}
          >
            Clear
          </Button>
        </XStack>
        <Form form={form}>
          <XStack px="$4" flexWrap="wrap">
            {Array.from({ length: Number(phraseLength) }).map((_, index) => (
              <Stack
                key={index}
                $md={{
                  flexBasis: '50%',
                }}
                flexBasis="33.33%"
                p="$1"
              >
                <Form.Field name={`phrase${index + 1}`}>
                  <PhaseInput
                    index={index}
                    onInputBlur={onInputBlur}
                    onInputChange={onInputChange}
                    onInputFocus={onInputFocus}
                  />
                </Form.Field>
              </Stack>
            ))}
          </XStack>
        </Form>
        <HeightTransition>
          {invalidWordsLength > 0 && (
            <XStack pt="$1.5" px="$5" key="invalidWord">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                {invalidWordsMessage(invalidWordsLength)}
              </SizableText>
            </XStack>
          )}
          {invalidPhrase && (
            <XStack pt="$1.5" px="$5" key="invalidPhrase">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                Invalid recovery phrase
              </SizableText>
            </XStack>
          )}
        </HeightTransition>
      </Page.Body>
      <PageFooter
        suggestions={suggestions}
        updateInputValue={updateInputValue}
      />
    </>
  );
}

const headerRight = () => (
  <HeaderIconButton
    icon="QuestionmarkOutline"
    onPress={() =>
      Dialog.show({
        title: 'Recovery Phrase',
        icon: 'Document2Outline',
        renderContent: <Tutorials list={tutorials} />,
        showFooter: false,
      })
    }
  />
);

export function ImportRecoveryPhrase() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" headerRight={headerRight} />
      <PageContent />
    </Page>
  );
}
