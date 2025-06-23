import { useCallback, useEffect, useState } from 'react';

import {
  Icon,
  Image,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

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
  value,
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
  tradeType,
  balance,
}: ITokenInputSectionProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const [internalValue, setInternalValue] = useState(value || '');

  useEffect(() => {
    if (value !== undefined && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value, internalValue]);

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

  const isTokenSelectorVisible =
    tradeType === ESwapDirection.BUY && selectableTokens.length > 1;

  return (
    <YStack gap="$0.5">
      <Input
        size="large"
        keyboardType="decimal-pad"
        value={internalValue}
        onChangeText={handleInternalChange}
        placeholder={tradeType === ESwapDirection.BUY ? 'Total' : 'Amount'}
        addOns={[
          {
            renderContent: (
              <XStack
                alignItems="center"
                gap="$1"
                px="$2"
                {...(isTokenSelectorVisible && {
                  onPress: () => setIsPopoverOpen(true),
                  userSelect: 'none',
                  hoverStyle: { bg: '$bgHover' },
                  pressStyle: { bg: '$bgActive' },
                  borderCurve: 'continuous',
                })}
              >
                {selectedToken?.logoURI ? (
                  <Image
                    src={selectedToken.logoURI}
                    width="$5"
                    height="$5"
                    borderRadius="$full"
                  />
                ) : null}
                <SizableText size="$bodyLg">
                  {selectedToken?.symbol}
                </SizableText>
                {isTokenSelectorVisible ? (
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                ) : null}
              </XStack>
            ),
          },
        ]}
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
          selectedToken?.speedSwapDefaultAmount?.map((amount) => ({
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
