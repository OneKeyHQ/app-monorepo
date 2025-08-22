import { HeaderIconButton, useShare } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EVisitTarget } from '@onekeyhq/shared/src/logger/scopes/dex/types';

import { buildMarketFullUrlV2 } from '../../../marketUtils';

interface IShareButtonProps {
  networkId: string;
  address: string;
}

export function ShareButton({ networkId, address }: IShareButtonProps) {
  const { shareText } = useShare();

  const handleShare = async () => {
    const url = buildMarketFullUrlV2({ networkId, address });
    // Track share action
    defaultLogger.dex.actions.dexVisitSite({
      visitTarget: EVisitTarget.ShareLink,
    });
    void shareText(url);
  };

  return <HeaderIconButton icon="ShareOutline" onPress={handleShare} />;
}
