import {
  ButtonFrame,
  Icon,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { QuickAmountSelector } from './QuickAmountSelector';

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
}

export function TokenInputSection({
  value,
  onChange,
  selectedToken,
  onPressTokenSelector,
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
              <XStack>
                <ButtonFrame
                  onPress={onPressTokenSelector}
                  disabled={!onPressTokenSelector}
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
            ),
          },
        ]}
      />
      <QuickAmountSelector onSelect={onChange} />
    </YStack>
  );
}
