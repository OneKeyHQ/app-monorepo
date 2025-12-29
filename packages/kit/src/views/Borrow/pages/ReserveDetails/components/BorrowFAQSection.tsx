import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { FAQContent } from '@onekeyhq/kit/src/views/Earn/components/FAQContent';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DetailsSectionContainer } from './DetailsSectionContainer';

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

  if (!isLoading && !faqList?.length) {
    return null;
  }

  return (
    <DetailsSectionContainer
      title={intl.formatMessage({ id: ETranslations.global_faqs })}
      showDivider={false}
    >
      <FAQContent faqList={faqList} isLoading={isLoading} />
    </DetailsSectionContainer>
  );
}
