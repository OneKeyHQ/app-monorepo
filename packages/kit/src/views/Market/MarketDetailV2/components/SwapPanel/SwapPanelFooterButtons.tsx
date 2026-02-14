import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  onBuy: () => void;
  onSell: () => void;
};

function SwapPanelFooterButtons({ onBuy, onSell }: IProps) {
  const intl = useIntl();

  return (
    <XStack gap="$2" alignItems="center">
      <Button
        size="small"
        variant="primary"
        w="$28"
        h="$12"
        bg="$buttonSuccess"
        onPress={onBuy}
      >
        {intl.formatMessage({
          id: ETranslations.global_buy,
        })}
      </Button>
      <Button
        w="$28"
        h="$12"
        size="small"
        bg="$buttonCritical"
        variant="primary"
        onPress={onSell}
      >
        {intl.formatMessage({
          id: ETranslations.global_sell,
        })}
      </Button>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
