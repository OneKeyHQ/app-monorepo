import {
  Alert,
  Button,
  Form,
  Heading,
  HeightTransition,
  Icon,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  useForm,
  usePageAvoidKeyboard,
} from '@onekeyhq/components';

function PageContent() {
  const form = useForm({});

  const invalidWordsLength = 0;
  const invalidPhrase = false;

  const { changePageAvoidHeight } = usePageAvoidKeyboard();
  const invalidWordsMessage = (length: number) => {
    if (length === 1) {
      return '1 invalid word';
    }
    return `${length} invalid words`;
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
  return (
    <Page.Body>
      <Alert
        type="warning"
        fullBleed
        title='Do not import recovery phrase from hardware wallet. Go back and use "Connect Hardware Wallet" instead.'
      />
      <XStack px="$5" pt="$5" pb="$2" justifyContent="space-between">
        <Button iconAfter="ChevronDownSmallOutline" variant="tertiary">
          12 words
        </Button>
        <Button icon="BroomOutline" variant="tertiary">
          Clear
        </Button>
      </XStack>
      <Form form={form}>
        <XStack px="$4" flexWrap="wrap">
          {Array.from({ length: 12 }).map((_, index) => (
            <Stack key={index} flexBasis="33.33%" p="$1">
              <Form.Field name={`phrase${index + 1}`}>
                <Input
                  pl="$8"
                  returnKeyType="next"
                  onFocus={() => {
                    changePageAvoidHeight(() => 90);
                  }}
                />
              </Form.Field>
              <SizableText
                pointerEvents="none"
                position="absolute"
                color="$textDisabled"
                top={11}
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
      <Stack p="$5">
        {tutorials.map(({ title, description }) => (
          <Stack pt="$5" key={title}>
            <Heading size="$headingSm">{title}</Heading>
            <SizableText size="$bodyMd" mt="$1" color="$textSubdued">
              {description}
            </SizableText>
          </Stack>
        ))}
      </Stack>
    </Page.Body>
  );
}

export function ImportRecoveryPhrase() {
  return (
    <Page safeAreaEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PageContent />
      <Page.Footer onConfirm={() => console.log('confirm')} />
    </Page>
  );
}
