import type { IIconButtonProps } from '@onekeyhq/components';
import {
  HeaderIconButton,
  IconButton,
  InteractiveIcon,
  useShare,
} from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  buildMarketFullUrlV2,
  buildMarketStockFullUrlV2,
} from '../../../marketUtils';

interface IShareButtonProps {
  networkId: string;
  address: string;
  isNative?: boolean;
  size?: string;
  useIconButton?: boolean;
  // Stock detail pages live under their own route, so sharing has to point at
  // the listing instead of the chain/contract pair of the wrapping token.
  stockId?: string;
}

export function ShareButton({
  networkId,
  address,
  isNative,
  size,
  useIconButton,
  stockId,
}: IShareButtonProps) {
  const { shareText } = useShare();

  const handleShare = async () => {
    if (stockId) {
      void shareText(buildMarketStockFullUrlV2({ stockId }));
      return;
    }

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
        testID="market-url-icon-btn"
        icon="ShareOutline"
        variant="tertiary"
        size={(size as IIconButtonProps['size']) || 'medium'}
        onPress={handleShare}
      />
    );
  }

  // If size is provided, use InteractiveIcon for consistency with other small buttons
  if (size) {
    return (
      <InteractiveIcon
        icon="ShareOutline"
        onPress={handleShare}
        size={size}
        testID="market-url-icon"
      />
    );
  }

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
