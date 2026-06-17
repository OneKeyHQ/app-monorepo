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
  cursor: 'pointer',
};

function getButtonInteractiveStyleProps(isActive: boolean): IButtonProps {
  return {
    ...commonButtonStyleProps,
    hoverStyle: {
      opacity: 0.9,
      ...(isActive ? undefined : { bg: '$bgHover' }),
    },
    pressStyle: {
      opacity: 0.7,
      ...(isActive ? undefined : { bg: '$bgActive' }),
    },
  };
}

export interface ITradeTypeSelectorProps {
  value: ITradeType;
  onChange: (value: ITradeType) => void;
  size?: IButtonProps['size'];
  buyTestID?: string;
  sellTestID?: string;
}

export function TradeTypeSelector({
  value,
  onChange,
  size,
  buyTestID,
  sellTestID,
}: ITradeTypeSelectorProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isBuyActive = value === 'buy';
  const isSellActive = value === 'sell';

  const buttonSize = size ?? (gtMd ? 'small' : 'medium');

  const options = [
    {
      value: ESwapDirection.BUY,
      label: (
        <Button
          testID={buyTestID ?? 'market-options-btn'}
          onPress={() => {
            onChange(ESwapDirection.BUY);
          }}
          {...getButtonInteractiveStyleProps(isBuyActive)}
          bg={isBuyActive ? '$bgSuccessStrong' : '$transparent'}
          color={isBuyActive ? '$textOnColor' : '$textSubdued'}
          size={buttonSize}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
      ),
    },
    {
      value: ESwapDirection.SELL,
      label: (
        <Button
          testID={sellTestID ?? 'market-options-btn'}
          onPress={() => {
            onChange(ESwapDirection.SELL);
          }}
          bg={isSellActive ? '$bgCriticalStrong' : '$transparent'}
          color={isSellActive ? '$textOnColor' : '$textSubdued'}
          size={buttonSize}
          {...getButtonInteractiveStyleProps(isSellActive)}
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
        if (newValue === 'buy' || newValue === 'sell') {
          onChange(newValue as ITradeType);
        }
      }}
      options={options}
      backgroundColor="$neutral5"
      borderRadius="$2.5"
      h="auto"
      p="$0.5"
      fullWidth
      segmentControlItemStyleProps={{
        bg: '$transparent',
        p: 0,
      }}
    />
  );
}
