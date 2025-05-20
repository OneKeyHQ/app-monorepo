import { useMemo } from 'react';

import {
  ButtonFrame,
  Icon,
  Input,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';

import { QuickAmountSelector } from './QuickAmountSelector';
import { TokenList } from './TokenList';

import type { ITradeType } from '../../hooks/useTradeType';
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
  value,
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
  tradeType,
}: ITokenInputSectionProps) {
  return (
    <YStack gap="$0.5">
      <Input
        placeholder="Total"
        value={value}
        onChangeText={(text) => {
          if (validateAmountInput(text)) {
            onChange(text);
          }
        }}
        addOns={[
          {
            renderContent: (
              <Popover
                title="Select Token"
                renderContent={
                  <TokenList
                    tokens={selectableTokens}
                    onTokenPress={(token) => {
                      onTokenChange(token);
                    }}
                  />
                }
                renderTrigger={
                  <XStack>
                    <ButtonFrame
                      paddingHorizontal="$2.5"
                      paddingVertical="$1.5"
                      flex={1}
                      borderWidth={0}
                      background="transparent"
                      hoverStyle={{ bg: '$bgHover' }}
                      pressStyle={{ bg: '$bgActive' }}
                    >
                      <XStack
                        gap="$2"
                        alignItems="center"
                        justifyContent="space-between"
                        flex={1}
                      >
                        <SizableText color="$text" numberOfLines={1}>
                          {selectedToken?.symbol || 'Select Token'}
                        </SizableText>
                        <Icon
                          name="ChevronDownSmallOutline"
                          size="$5"
                          color="$iconSubdued"
                        />
                      </XStack>
                    </ButtonFrame>
                  </XStack>
                }
              />
            ),
          },
        ]}
      />
      <QuickAmountSelector onSelect={onChange} tradeType={tradeType} />
    </YStack>
  );
}
