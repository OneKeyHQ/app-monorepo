import { useState } from 'react';

import {
  ButtonFrame,
  Icon,
  Input,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
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
  value,
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
  tradeType,
}: ITokenInputSectionProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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
        leftAddOnProps={{
          label: (
            <SizableText size="$bodyMd" color="$text">
              {tradeType === ESwapDirection.BUY ? 'Total' : 'Amount'}
            </SizableText>
          ),
        }}
        addOns={[
          {
            renderContent:
              tradeType === ESwapDirection.BUY ? (
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
                        onTokenPress={(token) => {
                          onTokenChange(token);
                          setIsPopoverOpen(false);
                        }}
                      />
                    </AccountSelectorProviderMirror>
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
                        onPress={() => setIsPopoverOpen(true)}
                      >
                        <XStack
                          gap="$2"
                          alignItems="center"
                          justifyContent="space-between"
                          flex={1}
                        >
                          <SizableText color="$textSubdued">
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
              ) : (
                <XStack
                  paddingHorizontal="$2.5"
                  paddingVertical="$1.5"
                  alignItems="center"
                  flex={1}
                >
                  <SizableText color="$textSubdued">
                    {selectedToken?.symbol}
                  </SizableText>
                </XStack>
              ),
          },
        ]}
      />
      <QuickAmountSelector
        buyAmounts={
          selectedToken?.speedSwapDefaultAmount.map((amount) => ({
            label: amount.toString(),
            value: amount,
          })) ?? []
        }
        onSelect={onChange}
        tradeType={tradeType}
      />
    </YStack>
  );
}
