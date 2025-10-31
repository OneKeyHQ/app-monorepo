import {
  HeaderIconButton,
  IconButton,
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
  useIconButton?: boolean;
}

export function ShareButton({
  networkId,
  address,
  isNative,
  size,
  useIconButton,
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

  // If useIconButton is true, use IconButton for consistency with favorite button
  if (useIconButton) {
    return (
      <IconButton
        icon="ShareOutline"
        variant="tertiary"
        size="medium"
        onPress={handleShare}
      />
    );
  }

  // If size is provided, use InteractiveIcon for consistency with other small buttons
  if (size) {
    return (
      <InteractiveIcon icon="ShareOutline" onPress={handleShare} size={size} />
    );
  }

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
