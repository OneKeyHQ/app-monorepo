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
const testTokenData: ITokenData[] = [
  {
    id: 'usdt',
    tokenImageSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/usdt.svg',
    networkImageSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/sol.svg', // Assuming USDT on Solana network
    tokenSymbol: 'USDT',
    tokenName: 'Tether USD',
    balance: '5,000.00',
    valueProps: { value: '5,000.00', currency: '$' },
  },
  {
    id: 'usdc',
    tokenImageSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/usdc.svg',
    networkImageSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/sol.svg', // Assuming USDC on Solana network
    tokenSymbol: 'USDC',
    tokenName: 'USD Coin',
    balance: '10,250.75',
    valueProps: { value: '10,250.75', currency: '$' },
  },
  // Add more test tokens if needed
];

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
          // Add other props from TokenListItem as needed, e.g., drilling arrow
          // drillIn
        />
      ))}
    </YStack>
  );
}
