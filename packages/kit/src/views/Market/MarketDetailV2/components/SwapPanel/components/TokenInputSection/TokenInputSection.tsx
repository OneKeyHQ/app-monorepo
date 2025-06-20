import { useCallback, useState } from 'react';

import { Popover, SizableText, Stack, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

import { QuickAmountSelector } from './QuickAmountSelector';
import { TokenList } from './TokenList';

import type { IToken } from '../../types';

export interface ITokenInputSectionProps {
  value: string;
  onChange: (value: string) => void;
  selectedToken?: IToken;
  selectableTokens: IToken[];
  onTokenChange: (token: IToken) => void;
  onPressTokenSelector?: () => void;
  tradeType: ITradeType;
}

export function TokenInputSection({
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
  tradeType,
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
        <Popover
          title="Select Token"
          open={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          renderContent={
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.home,
                sceneUrl: '',
              }}
              enabledNum={[0]}
            >
              <TokenList
                onTradePress={() => {
                  setIsPopoverOpen(false);
                }}
                tokens={selectableTokens}
                onTokenPress={handleTokenSelect}
              />
            </AccountSelectorProviderMirror>
          }
          renderTrigger={<Stack />}
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
      />
    </YStack>
  );
}
