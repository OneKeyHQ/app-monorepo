import { useCallback, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Form,
  HeightTransition,
  Icon,
  Input,
  Page,
  Select,
  SizableText,
  Stack,
  XStack,
  useForm,
  useMedia,
  usePageAvoidKeyboard,
} from '@onekeyhq/components';

import { Tutorials } from '../Components';

import type { LayoutChangeEvent } from 'react-native';

const useAvoidKeyboardLayout = () => {
  const alertHeight = useRef(0);
  const { changePageAvoidHeight } = usePageAvoidKeyboard();
  const updateLayoutHeight = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    alertHeight.current = height;
  }, []);
  const changePageLayoutHeight = useCallback(() => {
    changePageAvoidHeight(() => alertHeight.current);
  }, [changePageAvoidHeight]);
  return {
    updateLayoutHeight,
    changeLayoutHeight: changePageLayoutHeight,
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
  { label: '12 words', value: 12 },
  { label: '15 words', value: 15 },
  { label: '18 words', value: 18 },
  { label: '21 words', value: 21 },
  { label: '24 words', value: 24 },
];

function PageContent() {
  const media = useMedia();
  const form = useForm({});
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
  const { updateLayoutHeight, changeLayoutHeight } = useAvoidKeyboardLayout();

  return (
    <Page.Body>
      <Stack onLayout={updateLayoutHeight}>
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
                  pl="$8"
                  returnKeyType="next"
                  onFocus={changeLayoutHeight}
                />
              </Form.Field>
              <SizableText
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
              </SizableText>
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
  );
}

export function ImportRecoveryPhrase() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PageContent />
      <Page.Footer onConfirm={() => console.log('confirm')} />
    </Page>
  );
}
