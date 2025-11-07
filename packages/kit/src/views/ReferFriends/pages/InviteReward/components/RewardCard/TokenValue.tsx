import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

export interface ITokenValueProps {
  tokenImageUri?: string;
  amount: string | number;
  symbol?: string;
  showToken?: boolean;
}

export function TokenValue({
  tokenImageUri,
  amount,
  symbol,
  showToken = true,
}: ITokenValueProps) {
  return (
    <XStack gap="$1" ai="center">
      {showToken && tokenImageUri ? (
        <Token size="xs" tokenImageUri={tokenImageUri} />
      ) : null}
      <SizableText size="$bodyMd">
        <NumberSizeableText
          formatter="value"
          size="$bodyMd"
          formatterOptions={{
            tokenSymbol: symbol,
          }}
        >
          {amount}
        </NumberSizeableText>
      </SizableText>
    </XStack>
  );
}
