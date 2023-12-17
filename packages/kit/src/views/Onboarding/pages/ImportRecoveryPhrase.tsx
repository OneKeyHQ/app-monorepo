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

import { Tutorials } from '../Components';

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

const mockWords = ['acacia', 'alfalfa', 'algebra', 'area', 'aphasia', 'asthma'];

interface IWordItemProps {
  word: string;
  onPress: (word: string) => void;
}
const WordItem = ({ word, onPress }: IWordItemProps) => {
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
};

const queryWordFromDict = (word: string) =>
  // mock query
  new Promise<string[]>((resolve) => {
    console.log(word);
    setTimeout(() => {
      resolve(mockWords.slice(Math.floor(mockWords.length * Math.random())));
    }, 100);
  });

const usePhraseSuggestion = (
  form: ReturnType<typeof useForm>,
  selectWordIndex: MutableRefObject<number>,
) => {
  const [words, setWords] = useState<string[]>([]);
  const updateWordValue = useCallback(
    (word: string) => {
      const index = selectWordIndex.current;
      const key = `phrase${index + 1}`;
      form.setValue(key, word);
    },
    [form, selectWordIndex],
  );

  const watchForm = useCallback(
    async (values: Record<string, string>) => {
      const index = selectWordIndex.current;
      if (index === -1) {
        setWords([]);
      }
      const key = `phrase${index + 1}`;
      const value = values[key];
      const dictWords = await queryWordFromDict(value);
      // check word in dict
      if (!value || mockWords.includes(value)) {
        setWords([]);
      } else {
        setWords(dictWords);
      }
    },
    [selectWordIndex],
  );

  useEffect(() => {
    form.watch(debounce(watchForm, 20));
  }, [form, selectWordIndex, watchForm]);
  return {
    suggestionWords: words,
    updateWordValue,
  };
};

function SuggestionList({
  form,
  selectWordIndex,
}: {
  form: ReturnType<typeof useForm>;
  selectWordIndex: MutableRefObject<number>;
}) {
  const isShow = useIsKeyboardShown();
  const { suggestionWords, updateWordValue } = usePhraseSuggestion(
    form,
    selectWordIndex,
  );
  return isShow ? (
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
      {suggestionWords.map((word) => (
        <WordItem key={word} word={word} onPress={updateWordValue} />
      ))}
    </ScrollView>
  ) : null;
}

function PageFooter({
  form,
  selectWordIndex,
}: {
  form: ReturnType<typeof useForm>;
  selectWordIndex: MutableRefObject<number>;
}) {
  return (
    <Page.Footer>
      <SuggestionList form={form} selectWordIndex={selectWordIndex} />
      <Page.FooterActions onConfirm={() => console.log('confirm')} />
    </Page.Footer>
  );
}

function PageContent() {
  const media = useMedia();
  const form = useForm({});
  const selectWordIndex = useRef(-1);
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

  const handleInputFocus = useCallback((index: number) => {
    selectWordIndex.current = index;
  }, []);

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
          />
        </Stack>
        <XStack px="$5" pt="$5" pb="$2" justifyContent="space-between">
          <Select
            title="Select a length"
            placement="bottom-start"
            items={phraseLengthOptions}
            value={phraseLength}
            onChange={setPhraseLength}
            renderTrigger={({ value }) => (
              <Button iconAfter="ChevronDownSmallOutline" variant="tertiary">
                {value} words
              </Button>
            )}
          />
          <Button icon="BroomOutline" variant="tertiary" onPress={handleClear}>
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
                  <Input
                    autoCorrect={false}
                    spellCheck={false}
                    size={media.md ? 'large' : 'medium'}
                    leftAddOnProps={{
                      label: `${index + 1}`,
                      minWidth: '$10',
                      justifyContent: 'center',
                    }}
                    onFocus={() => handleInputFocus(index)}
                    returnKeyType="next"
                  />
                </Form.Field>
                {/* <SizableText
                pointerEvents="none"
                position="absolute"
                color="$textDisabled"
                top={11}
                $md={{
                  top: 15,
                }}
                left="$3"
                zIndex="$1"
                minWidth={17}
                textAlign="right"
              >
                {index + 1}
              </SizableText> */}
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
      <PageFooter form={form} selectWordIndex={selectWordIndex} />
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
