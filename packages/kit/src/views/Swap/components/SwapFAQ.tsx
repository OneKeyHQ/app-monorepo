import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function SwapFAQ() {
  const intl = useIntl();

  const faqItems = useMemo(
    () => [
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q1 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a1 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q2 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a2 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q8 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a8 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q4 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a4 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q5 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a5 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q6 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a6 }),
      },
      {
        question: intl.formatMessage({ id: ETranslations.swap_faq_q7 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a7 }),
      },
    ],
    [intl],
  );

  return (
    <YStack gap="$4">
      <SizableText size="$heading2xl" color="$text" fontWeight="600">
        {intl.formatMessage({ id: ETranslations.swap_faq_title })}
      </SizableText>
      <YStack>
        <Accordion type="multiple">
          {faqItems.map(({ question, answer }, index) => (
            <YStack key={String(index)}>
              {index > 0 ? (
                <Stack height={1} bg="$borderSubdued" my="$2" />
              ) : null}
              <Accordion.Item value={String(index)}>
                <Accordion.Trigger
                  unstyled
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="space-between"
                  borderWidth={0}
                  bg="$transparent"
                  p={0}
                  py="$5"
                  m={0}
                  cursor="pointer"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <SizableText
                        textAlign="left"
                        flex={1}
                        size="$headingLg"
                        color="$text"
                        pr="$2"
                      >
                        {question}
                      </SizableText>
                      <Stack
                        animation="quick"
                        animateOnly={ANIMATE_ONLY_TRANSFORM}
                        rotate={open ? '180deg' : '0deg'}
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color="$iconSubdued"
                          size="$6"
                        />
                      </Stack>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    unstyled
                    p={0}
                    pt="$1"
                    pb="$5"
                    pr="$8"
                    animation="100ms"
                    animateOnly={ANIMATE_ONLY_OPACITY}
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText size="$bodyLg" color="$textSubdued">
                      {answer}
                    </SizableText>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </YStack>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

export default SwapFAQ;
