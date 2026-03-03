import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { SWAP_FAQ_HELP_URL } from '@onekeyhq/shared/src/config/appConfig';
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
        question: intl.formatMessage({ id: ETranslations.swap_faq_q3 }),
        answer: intl.formatMessage({ id: ETranslations.swap_faq_a3 }),
        link: {
          prefix: intl.formatMessage({
            id: ETranslations.swap_faq_help_center_for,
          }),
          text: intl.formatMessage({
            id: ETranslations.swap_faq_help_center_help,
          }),
          url: SWAP_FAQ_HELP_URL,
        },
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
          {faqItems.map(({ question, answer, link }, index) => (
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
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText size="$bodyLg" color="$textSubdued">
                      {answer}
                    </SizableText>
                    {link ? (
                      <SizableText size="$bodyLg" color="$textSubdued" mt="$2">
                        {link.prefix}
                        <SizableText
                          size="$bodyLg"
                          color="$textInteractive"
                          cursor="pointer"
                          hoverStyle={{ opacity: 0.6 }}
                          onPress={() => Linking.openURL(link.url)}
                          textDecorationLine="underline"
                        >
                          {link.text}
                        </SizableText>
                      </SizableText>
                    ) : null}
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
