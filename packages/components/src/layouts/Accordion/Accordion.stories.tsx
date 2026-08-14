import { Accordion } from '@onekeyhq/components/src/layouts/Accordion';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const TRIGGER_HOVER_STYLE = { bg: '$bgHover' } as const;
const TRIGGER_PRESS_STYLE = { bg: '$bgActive' } as const;
const CONTENT_HIDDEN_STYLE = { opacity: 0 } as const;
const MULTIPLE_OPEN = ['phrase', 'store'];

const FAQ_ITEMS = [
  {
    value: 'phrase',
    question: 'What is a recovery phrase?',
    answer:
      'A 12–24 word backup that restores every account in this wallet. Anyone holding it controls the funds.',
  },
  {
    value: 'store',
    question: 'Where should I keep it?',
    answer:
      'Offline. Write it on paper or steel and store it somewhere private — never in screenshots or cloud notes.',
  },
  {
    value: 'lost',
    question: 'What if I lose it?',
    answer:
      'Without the phrase (or another backup) the wallet cannot be restored once this device is gone.',
  },
] as const;

function FaqItem({
  value,
  question,
  answer,
}: {
  value: string;
  question: string;
  answer: string;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        gap="$2"
        borderWidth={0}
        px="$0"
        py="$2.5"
        bg="$transparent"
        hoverStyle={TRIGGER_HOVER_STYLE}
        pressStyle={TRIGGER_PRESS_STYLE}
      >
        {({ open }: { open: boolean }) => (
          <>
            <SizableText
              flex={1}
              textAlign="left"
              size="$bodyMdMedium"
              color={open ? '$text' : '$textSubdued'}
            >
              {question}
            </SizableText>
            <Stack animation="quick" rotate={open ? '-180deg' : '0deg'}>
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color={open ? '$iconActive' : '$iconSubdued'}
              />
            </Stack>
          </>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          unstyled
          animation="quick"
          enterStyle={CONTENT_HIDDEN_STYLE}
          exitStyle={CONTENT_HIDDEN_STYLE}
        >
          <SizableText size="$bodyMd" color="$textSubdued" pb="$3">
            {answer}
          </SizableText>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

// Accordion is the raw tamagui compound component (no OneKey styling layer):
// stories compose Item/Trigger/HeightAnimator/Content the way kit screens do —
// unstyled trigger, chevron driven by the `open` render prop.
const meta = {
  title: 'Layouts/Accordion',
  component: Accordion,
  args: {
    type: 'single',
  },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="phrase" maxWidth={360}>
      {FAQ_ITEMS.map((item) => (
        <FaqItem key={item.value} {...item} />
      ))}
    </Accordion>
  ),
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={MULTIPLE_OPEN} maxWidth={360}>
      {FAQ_ITEMS.map((item) => (
        <FaqItem key={item.value} {...item} />
      ))}
    </Accordion>
  ),
};
