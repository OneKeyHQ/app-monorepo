import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { FAQAccordion } from '@onekeyhq/kit/src/views/Staking/components/FAQAccordion';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DetailsSectionContainer } from './DetailsSectionContainer';

function FAQPanelSkeleton() {
  return (
    <YStack gap="$2">
      {Array.from({ length: 4 }).map((_, index) => (
        <XStack key={index} px="$2" py="$1" mx="$-2">
          <Skeleton width="100%" height={16} borderRadius="$2" />
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
  const { result: faqData, isLoading } = usePromiseResult(
    async () => {
      if (!networkId || !provider || !marketAddress || !reserveAddress) {
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
          renderTitle={(item, { open }) => (
            <SizableText
              textAlign="left"
              flex={1}
              size="$bodyLgMedium"
              color={open ? '$text' : '$textSubdued'}
            >
              {item.question}
            </SizableText>
          )}
          renderContent={(item) => (
            <SizableText size="$bodyMd" color="$text" whiteSpace="pre-line">
              {item.answer}
            </SizableText>
          )}
        />
      )}
    </DetailsSectionContainer>
  );
}
