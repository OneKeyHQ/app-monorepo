import { memo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapSelectedTokenInfo } from '../../hooks/useSwapTokens';

interface ISwapInputContainerProps {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  onAmountChange?: (value: string) => void;
  amountValue: string;
  onSelectToken: (type: ESwapDirectionType) => void;
  balance: string;
  amountPrice?: string;
  address?: string;
}

const SwapInputContainer = ({
  onAmountChange,
  direction,
  token,
  amountValue,
  onSelectToken,
  balance,
  address,
  amountPrice,
}: ISwapInputContainerProps) => {
  const { isLoading } = useSwapSelectedTokenInfo({
    token,
    type: direction,
  });
  return (
    <YStack mx="$10">
      {token ? (
        <XStack>
          <SizableText>
            {direction === ESwapDirectionType.FROM ? 'From' : 'To'}
          </SizableText>
          <SizableText>{address ?? 'no address'}</SizableText>
        </XStack>
      ) : null}
      <AmountInput
        onChange={onAmountChange}
        value={amountValue}
        inputProps={{
          placeholder: '0.0',
          readOnly: direction === ESwapDirectionType.TO,
        }}
        tokenSelectorTriggerProps={{
          selectedNetworkImageUri: '',
          selectedTokenImageUri: token?.logoURI,
          selectedTokenSymbol: token?.symbol,
          onPress: () => {
            onSelectToken(direction);
          },
        }}
        balance={balance}
        enableMaxAmount={direction === ESwapDirectionType.FROM}
      />
    </YStack>
  );
};

export default memo(SwapInputContainer);
