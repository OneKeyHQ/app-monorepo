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
} from '@onekeyhq/components';

export function ImportRecoveryPhrase() {
  const form = useForm({});

  const invalidWordsLength = 0;
  const invalidPhrase = false;

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
    <Page>
      <Page.Header title="Import Recovery Phrase" />
      <Page.Body>
        {/* warning message */}
        <Stack p="$5" pt="$0">
          <Alert
            type="warning"
            closable
            title='Do not import recovery phrase from hardware wallet. Go back and use "Connect Hardware Wallet" instead.'
          />
        </Stack>

        {/* form */}
        <Stack p="$5" pt="$0">
          {/* select and clear action */}
          <XStack pb="$2" justifyContent="space-between">
            <Button iconAfter="ChevronDownSmallOutline" variant="tertiary">
              12 words
            </Button>
            <Button icon="BroomOutline" variant="tertiary">
              Clear
            </Button>
          </XStack>

          {/* inputs */}
          <Form form={form}>
            <XStack mx="$-1" flexWrap="wrap">
              {Array.from({ length: 12 }).map((_, index) => (
                <Stack key={index} flexBasis="33.33%" p="$1">
                  <Form.Field name={`phrase${index + 1}`}>
                    <Input pl="$8" returnKeyType="next" />
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

          {/* error messages */}
          <HeightTransition>
            {invalidWordsLength > 0 && (
              <XStack pt="$2" key="invalidWord">
                <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
                <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                  {invalidWordsMessage(invalidWordsLength)}
                </SizableText>
              </XStack>
            )}
            {invalidPhrase && (
              <XStack pt="$2" key="invalidPhrase">
                <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
                <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                  Invalid recovery phrase
                </SizableText>
              </XStack>
            )}
          </HeightTransition>
        </Stack>

        {/* about recovery phrase */}
        <Stack p="$5">
          {tutorials.map(({ title, description }, index) => (
            <Stack
              key={title}
              {...(index !== 0 && {
                pt: '$5',
              })}
            >
              <Heading size="$headingSm">{title}</Heading>
              <SizableText size="$bodyMd" mt="$1" color="$textSubdued">
                {description}
              </SizableText>
            </Stack>
          ))}
        </Stack>
      </Page.Body>
      <Page.Footer onConfirm={() => console.log('confirm')} />
    </Page>
  );
}
