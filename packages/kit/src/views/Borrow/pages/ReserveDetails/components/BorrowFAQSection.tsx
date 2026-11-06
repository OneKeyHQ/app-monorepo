import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { FAQAccordion } from '@onekeyhq/kit/src/views/Staking/components/FAQAccordion';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DetailsSectionContainer } from './DetailsSectionContainer';

function FAQPanelSkeleton() {
  return (
    <YStack>
      {Array.from({ length: 4 }).map((_, index) => (
        <XStack key={index} py="$5">
          <Skeleton width="100%" height={24} borderRadius="$2" />
        </XStack>
      ))}
    </YStack>
  );
}

export function BorrowFAQSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  const { result: faqData, isLoading } = usePromiseResult(
    async () => {
      if (
        !networkId ||
        !provider ||
        !marketAddress ||
        reserveAddress === undefined
      ) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getBorrowFaqList({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
      });
    },
    [networkId, provider, marketAddress, reserveAddress],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const faqList = faqData?.list;
  const hasFaqList = Boolean(faqList?.length);

  if (!isLoading && !hasFaqList) {
    return null;
  }

  return (
    <DetailsSectionContainer
      title={intl.formatMessage({ id: ETranslations.global_faqs })}
      titleTextProps={{ size: '$headingLg', color: '$text' }}
      showDivider={false}
    >
      {isLoading && !hasFaqList ? (
        <FAQPanelSkeleton />
      ) : (
        <FAQAccordion
          items={faqList}
          renderTitle={(item) => (
            <SizableText
              textAlign="left"
              flex={1}
              size={media.gtMd ? '$headingLg' : '$headingMd'}
              color="$text"
              pr="$2"
            >
              {item.question}
            </SizableText>
          )}
          renderContent={(item) => (
            <SizableText
              size="$bodyLg"
              color="$textSubdued"
              whiteSpace="pre-line"
            >
              {item.answer}
            </SizableText>
          )}
        />
      )}
    </DetailsSectionContainer>
  );
}
