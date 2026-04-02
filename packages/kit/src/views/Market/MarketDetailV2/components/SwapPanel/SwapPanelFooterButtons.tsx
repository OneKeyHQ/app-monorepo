import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  onTrade: () => void;
  onInstant: () => void;
};

function SwapPanelFooterButtons({ onTrade, onInstant }: IProps) {
  const intl = useIntl();
  return (
    <XStack gap="$2.5">
      <Button size="large" variant="secondary" flex={1} onPress={onTrade}>
        {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
      </Button>
      <Button
        size="large"
        variant="primary"
        flex={1}
        bg="$buttonSuccess"
        onPress={onInstant}
        icon="FlashSolid"
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_quick_buy })}
      </Button>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
