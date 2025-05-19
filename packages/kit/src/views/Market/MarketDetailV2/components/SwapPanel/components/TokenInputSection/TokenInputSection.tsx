import {
  ButtonFrame,
  Icon,
  Input,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { QuickAmountSelector } from './QuickAmountSelector';
import { TokenList } from './TokenList';

import type { ITradeType } from '../../hooks/useTradeType';

interface IToken {
  label: string;
  value: string;
  price?: number; // Optional as it might not be needed for display in select
}

export interface ITokenInputSectionProps {
  value: string;
  onChange: (value: string) => void;
  selectedToken?: IToken;
  selectableTokens: IToken[];
  onTokenChange: (tokenSymbol: string) => void;
  onPressTokenSelector?: () => void;
  tradeType: ITradeType;
}

export function TokenInputSection({
  value,
  onChange,
  selectedToken,
  onTokenChange,
  tradeType,
}: ITokenInputSectionProps) {
  return (
    <YStack gap="$0.5">
      <Input
        placeholder="Total"
        value={value}
        onChangeText={onChange}
        addOns={[
          {
            renderContent: (
              <Popover
                title="Select Token"
                renderContent={
                  <TokenList
                    onTokenPress={(token) => {
                      onTokenChange(token.id);
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
                          {selectedToken?.label || 'Select Token'}
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
