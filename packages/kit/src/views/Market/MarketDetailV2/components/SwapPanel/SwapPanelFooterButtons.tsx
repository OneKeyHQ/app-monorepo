import { useIntl } from 'react-intl';

import { Button, Icon, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

import type { IMarketDetailFooterMode } from '../../utils/marketMobileDetailKind';

type IProps = {
  mode: IMarketDetailFooterMode;
  onBuy: () => void;
  onSell: () => void;
  onPerps?: () => void;
  tradeDisabled?: boolean;
  perpsDisabled?: boolean;
};

function SwapPanelFooterButtons({
  mode,
  onBuy,
  onSell,
  onPerps,
  tradeDisabled,
  perpsDisabled,
}: IProps) {
  const intl = useIntl();

  return (
    <XStack gap="$2.5">
      <Button
        testID={MarketTestIDs.detailBuyButton}
        size="large"
        height={50}
        variant="secondary"
        bg="$bgSuccessStrong"
        color="$textOnColor"
        hoverStyle={{ bg: '$success10' }}
        pressStyle={{ bg: '$success11' }}
        flex={1}
        disabled={tradeDisabled}
        onPress={onBuy}
      >
        {intl.formatMessage({ id: ETranslations.global_buy })}
      </Button>
      <Button
        testID={MarketTestIDs.detailSellButton}
        size="large"
        height={50}
        variant="destructive"
        flex={1}
        disabled={tradeDisabled}
        onPress={onSell}
      >
        {intl.formatMessage({ id: ETranslations.global_sell })}
      </Button>
      {mode === 'perps-buy-sell' ? (
        <Button
          testID={MarketTestIDs.detailPerpsButton}
          size="large"
          height={50}
          variant="secondary"
          width={50}
          px="$3"
          childrenAsText={false}
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.perps_perps,
          })}
          disabled={perpsDisabled}
          onPress={onPerps}
        >
          <Icon name="TradeOutline" size="$6" color="$icon" />
        </Button>
      ) : null}
    </XStack>
  );
}

export default SwapPanelFooterButtons;
