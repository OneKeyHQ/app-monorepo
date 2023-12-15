import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import {
  type LayoutChangeEvent,
  type View,
  findNodeHandle,
} from 'react-native';

import type { IElement } from '@onekeyhq/components';
import {
  Alert,
  Button,
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
  useMedia,
  usePage,
} from '@onekeyhq/components';

import { Tutorials } from '../Components';

const useScrollToInputArea = (ref: RefObject<View>) => {
  const { pageRef, getContentOffset } = usePage();
  const scrollToInputArea = useCallback(() => {
    const refHandle = findNodeHandle(ref.current);
    if (ref.current && refHandle) {
      ref.current?.measureLayout(refHandle, (left, top, width, height) => {
        if (getContentOffset().y < height) {
          pageRef?.scrollTo({ x: 0, y: top + height, animated: true });
        }
      });
    }
  }, [getContentOffset, pageRef, ref]);
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

const words = ['acacia', 'alfalfa', 'algebra', 'area', 'aphasia', 'asthma'];
const WordItem = ({ word }: { word: string }) => (
  <Stack
    bg="$backgroundHover"
    py="$1"
    px="$2"
    borderRadius="$2"
    mr="$4"
    onPress={() => {
      console.log('123123');
    }}
  >
    <SizableText>{word}</SizableText>
  </Stack>
);

function PageFooter() {
  const isShow = useIsKeyboardShown();
  return (
    <Page.Footer extraData={isShow}>
      {isShow ? (
        <ScrollView
          horizontal
          contentContainerStyle={{
            px: '$4',
            py: '$2',
          }}
          showsHorizontalScrollIndicator={false}
        >
          {words.map((word) => (
            <WordItem word={word} />
          ))}
        </ScrollView>
      ) : null}
      <Page.FooterActions onConfirm={() => console.log('confirm')} />
    </Page.Footer>
  );
}

function PageContent() {
  const media = useMedia();
  const form = useForm({});
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
  const { scrollToInputArea } = useScrollToInputArea(alertRef);

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
            placement="right-start"
            items={phraseLengthOptions}
            value={phraseLength}
            onChange={setPhraseLength}
            renderTrigger={({ value }) => (
              <Button iconAfter="ChevronDownSmallOutline" variant="tertiary">
                {value} words
              </Button>
            )}
          />
          <Button icon="BroomOutline" variant="tertiary">
            Clear
          </Button>
        </XStack>
        <Form form={form}>
          <XStack px="$4" flexWrap="wrap">
            {Array.from({ length: phraseLength }).map((_, index) => (
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
                    size={media.md ? 'large' : 'medium'}
                    leftAddOnProps={{
                      label: `${index + 1}`,
                      minWidth: '$10',
                      justifyContent: 'center',
                    }}
                    onFocus={scrollToInputArea}
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
        <Stack px="$5">
          <Tutorials list={tutorials} />
        </Stack>
      </Page.Body>
      <PageFooter />
    </>
  );
}

export function ImportRecoveryPhrase() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PageContent />
    </Page>
  );
}
