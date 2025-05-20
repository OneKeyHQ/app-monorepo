import { YStack } from '@onekeyhq/components';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';

// Define the props for each token item
interface ITokenData {
  id: string;
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenSymbol?: string;
  tokenName?: string;
  balance?: string;
  valueProps?: { value: string; currency?: string };
}

// Test data based on the provided image and typical token list items
const testTokenData: ITokenData[] = [];

interface ITokenListProps {
  tokens?: ITokenData[];
  onTokenPress?: (token: ITokenData) => void;
}

export function TokenList({
  tokens = testTokenData, // Default to test data
  onTokenPress,
}: ITokenListProps) {
  return (
    <YStack gap="$2" px="$4" py="$2">
      {tokens.map((token) => (
        <TokenListItem
          key={token.id}
          tokenImageSrc={token.tokenImageSrc}
          networkImageSrc={token.networkImageSrc}
          tokenSymbol={token.tokenSymbol}
          tokenName={token.tokenName}
          balance={token.balance}
          valueProps={token.valueProps}
          onPress={() => onTokenPress?.(token)}
        />
      ))}
    </YStack>
  );
}
