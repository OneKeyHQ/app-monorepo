import {
  HeaderIconButton,
  InteractiveIcon,
  useShare,
} from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { buildMarketFullUrlV2 } from '../../../marketUtils';

interface IShareButtonProps {
  networkId: string;
  address: string;
  isNative?: boolean;
  size?: string;
}

export function ShareButton({
  networkId,
  address,
  isNative,
  size,
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

  // If size is provided, use InteractiveIcon for consistency with other small buttons
  if (size) {
    return (
      <InteractiveIcon icon="ShareOutline" onPress={handleShare} size={size} />
    );
  }

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
