import { HeaderIconButton, useShare } from '@onekeyhq/components';

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
    const url = buildMarketFullUrlV2({
      networkId,
      address,
      isNative,
    });
    void shareText(url);
  };

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
