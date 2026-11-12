import { useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const ROW_ENTER_STYLE = { opacity: 0, y: -4 } as const;
const ROW_ANIMATED_PROPERTIES = ['opacity', 'transform'];
const LIST_ANIMATED_PROPERTIES = ['opacity'];
const LIST_ROWS = ['First item', 'Second item', 'Third item'];

function AccordionExample() {
  const [value, setValue] = useState('section');
  const [actionCount, setActionCount] = useState(0);
  const reduceMotion = useReducedMotion();
  const expanded = value === 'section';
  return (
    <YStack maxWidth={640} width="100%">
      <Accordion
        type="single"
        collapsible
        value={value}
        onValueChange={setValue}
      >
        <Accordion.Item
          value="section"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
          overflow="hidden"
        >
          <Accordion.Trigger
            unstyled
            testID="accordion-gallery-trigger"
            flexDirection="row"
            alignItems="center"
            minHeight={56}
            px="$5"
            bg="$bgSubdued"
          >
            <SizableText flex={1} size="$bodyLgMedium">
              Section title
            </SizableText>
            <SizableText size="$bodyLgMedium">$0.01</SizableText>
            <Stack
              ml="$3"
              transition={reduceMotion ? undefined : 'quick'}
              rotate={expanded ? '180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </Stack>
          </Accordion.Trigger>
          <Accordion.HeightAnimator
            transition={
              reduceMotion
                ? undefined
                : ['smooth', { duration: expanded ? 250 : 200 }]
            }
          >
            <Accordion.Content
              unstyled
              opacity={expanded ? 1 : 0}
              transition={reduceMotion ? undefined : 'quick'}
              animateOnly={LIST_ANIMATED_PROPERTIES}
            >
              <XStack
                testID="accordion-gallery-content"
                px="$5"
                py="$3"
                gap="$3"
                alignItems="center"
                justifyContent="space-between"
                aria-hidden={!expanded}
                accessibilityElementsHidden={!expanded}
                importantForAccessibility={
                  expanded ? 'auto' : 'no-hide-descendants'
                }
                pointerEvents={expanded ? 'auto' : 'none'}
                {...(platformEnv.isNative ? {} : { inert: !expanded })}
              >
                <SizableText>Content with a separate action</SizableText>
                <Button
                  testID="accordion-gallery-action"
                  size="small"
                  onPress={() => setActionCount((count) => count + 1)}
                >
                  {`Action ${actionCount}`}
                </Button>
              </XStack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

function AnimatedListExample() {
  const [value, setValue] = useState('');
  const reduceMotion = useReducedMotion();
  const expanded = value === 'items';
  return (
    <YStack maxWidth={640} width="100%">
      <Accordion
        type="single"
        collapsible
        value={value}
        onValueChange={setValue}
      >
        <Accordion.Item value="items">
          <Accordion.Trigger
            unstyled
            testID="accordion-gallery-list-trigger"
            minHeight={48}
            justifyContent="center"
            px="$4"
            borderRadius="$3"
            bg="$bgSubdued"
          >
            <SizableText>{expanded ? 'Hide items' : 'Show items'}</SizableText>
          </Accordion.Trigger>
          <Accordion.HeightAnimator
            transition={
              reduceMotion
                ? undefined
                : ['smooth', { duration: expanded ? 250 : 200 }]
            }
          >
            <Accordion.Content
              unstyled
              testID="accordion-gallery-list-content"
              opacity={expanded ? 1 : 0}
              transition={reduceMotion ? undefined : 'quick'}
              animateOnly={LIST_ANIMATED_PROPERTIES}
            >
              <YStack
                gap="$2"
                pt="$2"
                aria-hidden={!expanded}
                accessibilityElementsHidden={!expanded}
                importantForAccessibility={
                  expanded ? 'auto' : 'no-hide-descendants'
                }
                pointerEvents={expanded ? 'auto' : 'none'}
                {...(platformEnv.isNative ? {} : { inert: !expanded })}
              >
                {LIST_ROWS.map((item, index) => {
                  const transition: ['fast', { delay: number }] = [
                    'fast',
                    { delay: index * 20 },
                  ];
                  return (
                    <YStack
                      key={item}
                      testID={`accordion-gallery-list-row-${index}`}
                      transition={reduceMotion ? undefined : transition}
                      animateOnly={ROW_ANIMATED_PROPERTIES}
                      enterStyle={reduceMotion ? undefined : ROW_ENTER_STYLE}
                      px="$4"
                      py="$3"
                      borderRadius="$3"
                      bg="$bgSubdued"
                    >
                      <SizableText>{item}</SizableText>
                    </YStack>
                  );
                })}
              </YStack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

export default function AccordionGallery() {
  return (
    <Layout
      componentName="Accordion"
      elements={[
        { title: 'Controlled section', element: <AccordionExample /> },
        {
          title: 'List with staggered entry',
          element: <AnimatedListExample />,
        },
      ]}
    />
  );
}
