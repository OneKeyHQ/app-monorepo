import { useIntl } from 'react-intl';

import {
  Accordion,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function FAQPanelSkeleton() {
  return (
    <YStack gap="$4">
      <Skeleton width={80} height={24} borderRadius="$2" />
      <YStack gap="$2">
        {Array.from({ length: 4 }).map((_, index) => (
          <YStack key={index} gap="$2">
            <Skeleton width="100%" height={20} borderRadius="$2" />
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

export function FAQPanel({
  faqList,
  isLoading = false,
}: {
  faqList?: Array<{ question: string; answer: string }>;
  isLoading?: boolean;
}) {
  const intl = useIntl();

  if (isLoading) {
    return <FAQPanelSkeleton />;
  }

  if (!faqList?.length) {
    return null;
  }

  return (
    <YStack gap="$4">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {faqList.map(({ question, answer }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                my="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$headingSm"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {question}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pt="$2"
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <SizableText
                    size="$bodyMd"
                    color="$text"
                    whiteSpace="pre-line"
                  >
                    {answer}
                  </SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}
