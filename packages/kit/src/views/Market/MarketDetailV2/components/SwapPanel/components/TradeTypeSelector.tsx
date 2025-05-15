import { useIntl } from 'react-intl';

import {
  Button,
  type IButtonProps,
  SegmentControl,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ITradeType } from '../useSwapPanel';

const commonButtonStyleProps: IButtonProps = {
  flex: 1,
  borderRadius: '$2',
  borderWidth: 0,
  height: '$8',
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
  const isBuyActive = value === 'buy';
  const isSellActive = value === 'sell';

  const options = [
    {
      value: 'buy' as ITradeType,
      label: (
        <Button
          {...commonButtonStyleProps}
          bg={isBuyActive ? '$iconSuccess' : '$transparent'}
          color={isBuyActive ? '$textOnColor' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
      ),
    },
    {
      value: 'sell' as ITradeType,
      label: (
        <Button
          bg={isSellActive ? '$iconCritical' : '$transparent'}
          color={isSellActive ? '$textOnColor' : '$textSubdued'}
          {...commonButtonStyleProps}
        >
          {intl.formatMessage({ id: ETranslations.global_sell })}
        </Button>
      ),
    },
  ];

  return (
    <SegmentControl
      value={value}
      onChange={(newValue) => {
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
