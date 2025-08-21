import { useIntl } from 'react-intl';

import {
  Button,
  type IButtonProps,
  SegmentControl,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ESwapDirection, type ITradeType } from '../hooks/useTradeType';

const commonButtonStyleProps: IButtonProps = {
  flex: 1,
  borderRadius: '$2',
  borderWidth: 0,
  hoverStyle: {
    opacity: 0.9,
  },
  pressStyle: {
    opacity: 0.7,
  },
};

export interface ITradeTypeSelectorProps {
  value: ITradeType;
  onChange: (value: ITradeType) => void;
}

export function TradeTypeSelector({
  value,
  onChange,
}: ITradeTypeSelectorProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isBuyActive = value === 'buy';
  const isSellActive = value === 'sell';

  const options = [
    {
      value: ESwapDirection.BUY,
      label: (
        <Button
          onPress={() => {
            console.log('onPress');
            onChange(ESwapDirection.BUY);
          }}
          {...commonButtonStyleProps}
          bg={isBuyActive ? '$iconSuccess' : '$transparent'}
          color={isBuyActive ? '$textOnColor' : '$textSubdued'}
          size={gtMd ? 'small' : 'medium'}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
      ),
    },
    {
      value: ESwapDirection.SELL,
      label: (
        <Button
          onPress={() => {
            console.log('onPress');
            onChange(ESwapDirection.SELL);
          }}
          bg={isSellActive ? '$iconCritical' : '$transparent'}
          color={isSellActive ? '$textOnColor' : '$textSubdued'}
          size={gtMd ? 'small' : 'medium'}
          {...commonButtonStyleProps}
        >
          {intl.formatMessage({ id: ETranslations.global_sell })}
        </Button>
      ),
    },
  ];

  return (
    <SegmentControl
      value={value as string}
      onChange={(newValue) => {
        console.log('newValue', newValue);

        if (newValue === 'buy' || newValue === 'sell') {
          onChange(newValue as ITradeType);
        }
      }}
      options={options}
      backgroundColor="$neutral5"
      borderRadius="$2.5"
      p="$0.5"
      fullWidth
      segmentControlItemStyleProps={{
        bg: '$transparent',
        p: 0,
      }}
    />
  );
}
