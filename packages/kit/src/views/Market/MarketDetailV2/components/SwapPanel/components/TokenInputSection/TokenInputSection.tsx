import { useCallback, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

import { QuickAmountSelector } from './QuickAmountSelector';
import { TokenSelectorPopover } from './TokenSelectorPopover';

import type { IToken } from '../../types';
import type BigNumber from 'bignumber.js';

export interface ITokenInputSectionProps {
  value: string;
  onChange: (value: string) => void;
  selectedToken?: IToken;
  selectableTokens: IToken[];
  onTokenChange: (token: IToken) => void;
  onPressTokenSelector?: () => void;
  tradeType: ITradeType;
  balance?: BigNumber;
}

export function TokenInputSection({
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
  tradeType,
  balance,
}: ITokenInputSectionProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // 内部测试变量，忽略外部的 value 和 onChange
  const [internalValue, setInternalValue] = useState('');

  const handleInternalChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    },
    [onChange],
  );

  const handleTokenSelect = useCallback(
    (token: IToken) => {
      onTokenChange(token);
      setIsPopoverOpen(false);
    },
    [onTokenChange],
  );

  return (
    <YStack gap="$0.5">
      <AmountInput
        value={internalValue}
        onChange={handleInternalChange}
        inputProps={{
          placeholder: tradeType === ESwapDirection.BUY ? 'Total' : 'Amount',
        }}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: selectedToken?.logoURI,
          selectedTokenSymbol: selectedToken?.symbol,
          loading: false,
          disabled: tradeType === ESwapDirection.SELL,
          onPress:
            tradeType === ESwapDirection.BUY
              ? () => setIsPopoverOpen(true)
              : undefined,
        }}
      />

      {tradeType === ESwapDirection.BUY ? (
        <TokenSelectorPopover
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          tokens={selectableTokens}
          onTokenPress={handleTokenSelect}
        />
      ) : null}

      <QuickAmountSelector
        buyAmounts={
          selectedToken?.speedSwapDefaultAmount.map((amount) => ({
            label: amount.toString(),
            value: amount,
          })) ?? []
        }
        onSelect={handleInternalChange}
        tradeType={tradeType}
        balance={balance}
      />
    </YStack>
  );
}
