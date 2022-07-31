import { FC } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Pressable,
  Skeleton,
  Text,
  Token,
  Typography,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useManageTokens } from '../../../hooks';
import { calculateGains } from '../../../utils/priceUtils';

interface TokenCellProps {
  borderTopRadius?: string | number;
  borderRadius?: string | number;
  borderTopWidth?: string | number;
  borderBottomWidth?: string | number;
  hidePriceInfo?: boolean;
  onPress?: () => void;
  token: TokenType;
}
const TokenCell: FC<TokenCellProps> = ({
  hidePriceInfo,
  borderTopRadius,
  borderRadius,
  borderBottomWidth,
  borderTopWidth,
  onPress,
  token,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { themeVariant } = useTheme();
  const { balances, charts } = useManageTokens();
  const { network } = useActiveWalletAccount();

  const tokenId = token.tokenIdOnNetwork || 'main';
  const balance = balances[tokenId] || 0;
  const chart = charts[tokenId] || [];
  let price;
  let basePrice;
  let tokenValue;
  if (chart.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    basePrice = chart[0][1];
    // eslint-disable-next-line prefer-destructuring
    price = chart[chart.length - 1][1];
    tokenValue = new BigNumber(balance).times(price).toNumber();
  }

  const { gain, percentageGain } = calculateGains({
    basePrice,
    price,
  });

  let gainTextColor = 'text-success';
  let gainTextBg = 'surface-success-subdued';
  if (typeof gain === 'number') {
    if (percentageGain === '0.00%') {
      gainTextColor = 'text-subdued';
      gainTextBg = 'surface-neutral-subdued';
    } else if (gain < 0) {
      gainTextColor = 'text-critical';
      gainTextBg = 'surface-critical-subdued';
    }
  }

  const decimal =
    tokenId === 'main'
      ? network?.nativeDisplayDecimals
      : network?.tokenDisplayDecimals;

  return (
    <Pressable.Item
      p={4}
      shadow={undefined}
      borderTopRadius={borderTopRadius}
      borderRadius={borderRadius}
      borderWidth={1}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
      borderTopWidth={borderTopWidth}
      borderBottomWidth={borderBottomWidth}
      onPress={onPress}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <Token size={8} src={token.logoURI} />
        <Box ml="12px" flexDirection="column" flex={1}>
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            isTruncated
          >
            {token.name}
          </Text>
          {balance ? (
            <FormatBalance
              balance={balance}
              suffix={token.symbol}
              formatOptions={{
                fixed: decimal ?? 4,
              }}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          ) : (
            <Skeleton shape={isVerticalLayout ? 'Body1' : 'Body2'} />
          )}
        </Box>
        {!isVerticalLayout && !hidePriceInfo && (
          <Box flexDirection="column" flex={1} alignItems="flex-end">
            {price !== undefined ? (
              <Typography.Body2Strong>
                <FormatCurrencyNumber value={price} />
              </Typography.Body2Strong>
            ) : (
              <Skeleton shape="Body2" />
            )}
          </Box>
        )}
        <Box flexDirection="column" flex={1} alignItems="flex-end">
          {tokenValue !== undefined ? (
            <>
              <Typography.Body2Strong>
                <FormatCurrencyNumber value={tokenValue} />
              </Typography.Body2Strong>
              <Box
                mt="4px"
                bg={gainTextBg}
                px="6px"
                py="2px"
                borderRadius="6px"
                justifyContent="center"
                alignItems="center"
              >
                <Typography.CaptionStrong color={gainTextColor}>
                  {percentageGain}
                </Typography.CaptionStrong>
              </Box>
            </>
          ) : (
            <Skeleton shape="Body2" />
          )}
        </Box>
      </Box>
    </Pressable.Item>
  );
};
TokenCell.displayName = 'TokenCell';

export default TokenCell;
