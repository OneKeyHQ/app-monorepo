import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { FAQContent } from '@onekeyhq/kit/src/views/Earn/components/FAQContent';

import { DetailsSectionContainer } from './DetailsSectionContainer';

export function BorrowFAQSection({
  provider,
  symbol,
}: {
  provider: string;
  symbol: string;
}) {
  const { result: faqList, isLoading } = usePromiseResult(
    async () => {
      if (!provider || !symbol) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getFAQList({
        provider,
        symbol,
      });
    },
    [provider, symbol],
    { watchLoading: true, revalidateOnFocus: true },
  );

  if (!isLoading && !faqList?.length) {
    return null;
  }

  return (
    <DetailsSectionContainer title="FAQ" showDivider={false}>
      <FAQContent faqList={faqList} isLoading={isLoading} />
    </DetailsSectionContainer>
  );
}
