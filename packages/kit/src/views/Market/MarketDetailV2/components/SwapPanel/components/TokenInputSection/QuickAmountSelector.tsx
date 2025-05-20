import { Button, Divider, XStack } from '@onekeyhq/components';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

export interface IQuickAmountSelectorProps {
  onSelect: (value: string) => void;
  tradeType: ITradeType;
  buyAmounts: { label: string; value: number }[];
}

const sellPercentages = [
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
];

export function QuickAmountSelector({
  onSelect,
  buyAmounts,
  tradeType,
}: IQuickAmountSelectorProps) {
  const amounts =
    tradeType === ESwapDirection.BUY ? buyAmounts : sellPercentages;
  const amountsLength = amounts.length;

  return (
    <XStack gap="$0">
      {amounts.map((amount, index) => (
        <>
          <Button
            key={amount.value}
            flex={1}
            size="medium"
            variant="secondary"
            borderTopRightRadius={index !== amountsLength - 1 ? 0 : '$2'}
            borderBottomRightRadius={index !== amountsLength - 1 ? 0 : '$2'}
            borderTopLeftRadius={index !== 0 ? 0 : '$2'}
            borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
            onPress={() => onSelect(amount.value.toString())}
          >
            {amount.label}
          </Button>
          {index !== amountsLength - 1 ? <Divider vertical /> : null}
        </>
      ))}
    </XStack>
  );
}
