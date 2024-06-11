import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptyNFT() {
  const intl = useIntl();
  return (
    <Empty
      testID="Wallet-No-NFT-Empty"
      icon="AiImagesOutline"
      title={intl.formatMessage({ id: ETranslations.nft_no_nfts })}
      description={intl.formatMessage({ id: ETranslations.nft_no_nfts_found })}
    />
  );
}

export { EmptyNFT };
