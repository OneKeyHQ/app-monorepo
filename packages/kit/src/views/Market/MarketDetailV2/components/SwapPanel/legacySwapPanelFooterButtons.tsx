import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

type IProps = {
  onTrade: () => void;
  onInstant: () => void;
  disabled?: boolean;
};

function SwapPanelFooterButtons({ onTrade, onInstant, disabled }: IProps) {
  const intl = useIntl();
  return (
    <XStack gap="$2.5">
      <Button
        testID={MarketTestIDs.detailSwapButton}
        size="large"
        variant="secondary"
        flex={1}
        disabled={disabled}
        onPress={onTrade}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
      </Button>
      <Button
        testID={MarketTestIDs.detailBuyButton}
        size="large"
        variant="accent"
        flex={1}
        disabled={disabled}
        onPress={onInstant}
        icon="FlashSolid"
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_quick_buy })}
      </Button>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
