import { memo } from 'react';

import { isEmpty } from 'lodash';

import {
  Accordion,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';

import { EarnTestIDs } from '../testIDs';

function FAQPanelSkeleton() {
  return (
    <YStack gap="$4">
      <Skeleton width={80} height={24} borderRadius="$2" />
      <YStack gap="$2">
        {Array.from({ length: 4 }).map((_, index) => (
          <YStack key={index} gap="$2">
            <Skeleton width="100%" height={32} borderRadius="$2" />
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

function BaseFAQContent({
  faqList,
  isLoading = false,
}: {
  faqList?: Array<{ question: string; answer: string }>;
  isLoading?: boolean;
}) {
  const media = useMedia();

  if (isLoading && isEmpty(faqList)) {
    return <FAQPanelSkeleton />;
  }

  if (!faqList?.length) {
    return null;
  }

  return (
    <Accordion testID={EarnTestIDs.faqSection} type="multiple" pb="$8">
      {faqList.map(({ question, answer }, index) => (
        <YStack key={question}>
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
                    size={media.gtMd ? '$headingLg' : '$headingMd'}
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
            <Accordion.HeightAnimator animation="quick" overflow="hidden">
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
                <SizableText
                  size="$bodyLg"
                  color="$textSubdued"
                  whiteSpace="pre-line"
                >
                  {answer}
                </SizableText>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </YStack>
      ))}
    </Accordion>
  );
}

export const FAQContent = memo(BaseFAQContent);
