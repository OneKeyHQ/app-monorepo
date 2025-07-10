import { HeaderIconButton, useShare } from '@onekeyhq/components';

import { buildMarketFullUrlV2 } from '../../../marketUtils';

interface IShareButtonProps {
  networkId: string;
  address: string;
}

export function ShareButton({ networkId, address }: IShareButtonProps) {
  const { shareText } = useShare();

  const handleShare = async () => {
    const url = buildMarketFullUrlV2({ networkId, address });
    void shareText(url);
  };

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
