import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IToken } from '../../types';

// Define the props for each token item
export interface ITokenListToken {
  id: string;
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenSymbol?: string;
  tokenName?: string;
  balance?: string;
  valueProps?: { value: string; currency?: string };
}

interface ITokenListProps {
  tokens?: IToken[];
  onTokenPress?: (token: IToken) => void;
}

export function TokenList({ tokens, onTokenPress }: ITokenListProps) {
  const intl = useIntl();
  console.log('TokenList tokens', tokens);

  return (
    <YStack gap="$1">
      <YStack gap="$1" px="$1" py="$1">
        {tokens?.map((token) => (
          <TokenListItem
            key={token.contractAddress}
            tokenImageSrc={token.logoURI}
            // TODO: add network image
            // networkImageSrc={token.networkId}
            tokenSymbol={token.symbol}
            tokenName={token.name}
            // TODO: add balance
            // balance={token.balance}
            // TODO: add value props
            // valueProps={token.valueProps}
            onPress={() => onTokenPress?.(token)}
            margin={0}
          />
        ))}
      </YStack>

      <YStack
        borderBottomLeftRadius="$3"
        borderBottomRightRadius="$3"
        backgroundColor="$bgSubdued"
        px="$5"
        py="$2"
        alignItems="center"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          If you wish to trade other tokens, switch to{' '}
          <SizableText fontWeight="bold">
            {intl.formatMessage({ id: ETranslations.global_trade })}
          </SizableText>
        </SizableText>
      </YStack>
    </YStack>
  );
}
