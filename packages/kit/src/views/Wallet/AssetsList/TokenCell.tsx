import { FC } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Pressable,
  Skeleton,
  Text,
  Token,
  TokenVerifiedIcon,
  Typography,
  useIsVerticalLayout,
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
  bg?: string;
  borderColor?: string;
}
const TokenCell: FC<TokenCellProps> = ({
  hidePriceInfo,
  borderTopRadius,
  borderRadius,
  borderBottomWidth,
  borderTopWidth,
  onPress,
  token,
  borderColor = 'border-subdued',
  bg = 'surface-default',
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { balances, charts, prices } = useManageTokens();
  const { network } = useActiveWalletAccount();

  const tokenId = token.tokenIdOnNetwork || 'main';
  const balance = balances[tokenId] || 0;
  const chart = charts[tokenId] || [];
  const price = prices[tokenId];
  let basePrice;
  let tokenValue;
  if (chart.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    basePrice = chart[0][1];
  }
  if (typeof price === 'string') {
    tokenValue = new BigNumber(balance).times(price).toNumber();
  } else if (price === null) {
    tokenValue = 0;
  }

  const { percentageGain, gainTextBg, gainTextColor } = calculateGains({
    basePrice,
    price,
  });

  const decimal =
    tokenId === 'main'
      ? network?.nativeDisplayDecimals
      : network?.tokenDisplayDecimals;

  return (
    <Pressable.Item
      p={4}
      bg={bg}
      shadow={undefined}
      borderTopRadius={borderTopRadius}
      borderRadius={borderRadius}
      borderWidth={1}
      borderColor={borderColor}
      borderTopWidth={borderTopWidth}
      borderBottomWidth={borderBottomWidth}
      onPress={onPress}
      w="100%"
      flexDirection="row"
      alignItems="center"
    >
      <Token size={8} src={token.logoURI} />
      <Box ml="12px" flexDirection="column" flex={1}>
        <Box flexDirection="row" alignItems="center">
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            isTruncated
          >
            {token.name}
          </Text>
          <TokenVerifiedIcon token={token} />
        </Box>
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
          <Typography.Body2 color="text-subdued">{balance}</Typography.Body2>
        )}
      </Box>
      {!isVerticalLayout && !hidePriceInfo && (
        <Box flexDirection="column" flex={1} alignItems="flex-end">
          {price === undefined ? (
            <Skeleton shape="Body2" />
          ) : (
            <Typography.Body2Strong>
              <FormatCurrencyNumber value={+(price || 0)} />
            </Typography.Body2Strong>
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
    </Pressable.Item>
  );
};
TokenCell.displayName = 'TokenCell';

export default TokenCell;
