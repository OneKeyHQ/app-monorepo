import { HeaderIconButton, useShare } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { buildMarketFullUrlV2 } from '../../../marketUtils';

interface IShareButtonProps {
  networkId: string;
  address: string;
  isNative?: boolean;
}

export function ShareButton({
  networkId,
  address,
  isNative,
}: IShareButtonProps) {
  const { shareText } = useShare();

  const handleShare = async () => {
    // Convert full networkId back to shortcode for URL
    const shortCode =
      networkUtils.getNetworkShortCode({ networkId }) || networkId;

    const url = buildMarketFullUrlV2({
      network: shortCode,
      address,
      isNative,
    });
    void shareText(url);
  };

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
