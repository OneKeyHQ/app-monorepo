import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

import type { IMarketDetailFooterMode } from '../../utils/marketMobileDetailKind';

type IProps = {
  mode: IMarketDetailFooterMode;
  onTrade: () => void;
  onPerps?: () => void;
  tradeDisabled?: boolean;
  perpsDisabled?: boolean;
};

function SwapPanelFooterButtons({
  mode,
  onTrade,
  onPerps,
  tradeDisabled,
  perpsDisabled,
}: IProps) {
  const intl = useIntl();
  const tradeLabel = intl.formatMessage({
    id: ETranslations.dexmarket_details_trade,
  });

  if (mode === 'trade') {
    return (
      <Button
        testID={MarketTestIDs.detailSwapButton}
        size="large"
        variant="primary"
        width="100%"
        disabled={tradeDisabled}
        onPress={onTrade}
      >
        {tradeLabel}
      </Button>
    );
  }

  return (
    <XStack gap="$2.5">
      <Button
        testID={MarketTestIDs.detailPerpsButton}
        size="large"
        variant="secondary"
        flex={1}
        disabled={perpsDisabled}
        onPress={onPerps}
      >
        {intl.formatMessage({ id: ETranslations.perps_perps })}
      </Button>
      <Button
        testID={MarketTestIDs.detailSwapButton}
        size="large"
        variant="primary"
        flex={1}
        disabled={tradeDisabled}
        onPress={onTrade}
      >
        {tradeLabel}
      </Button>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
