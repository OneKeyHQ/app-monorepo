import { FC, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Pressable,
  Skeleton,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useActiveSideAccount, useManageTokensOfAccount } from '../../../hooks';
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
  accountId: string;
  networkId: string;
}
const TokenCell: FC<TokenCellProps> = ({
  accountId,
  networkId,
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
  const { balances, charts, prices } = useManageTokensOfAccount({
    accountId,
    networkId,
  });
  const { network } = useActiveSideAccount({ accountId, networkId });

  const tokenId = token.tokenIdOnNetwork || 'main';
  const balance = balances[tokenId];
  const chart = charts[tokenId] || [];
  const price = prices[tokenId];
  let basePrice;
  if (chart.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    basePrice = chart[0][1];
  }

  const { percentageGain, gainTextBg, gainTextColor } = calculateGains({
    basePrice,
    price,
  });

  const decimal =
    tokenId === 'main'
      ? network?.nativeDisplayDecimals
      : network?.tokenDisplayDecimals;

  const tokenValue = useMemo(() => {
    if (typeof balance === 'undefined' || typeof price === 'undefined')
      return undefined;
    if (price === null) return 0;
    return new BigNumber(balance).times(price).toNumber() || 0;
  }, [balance, price]);

  const formatedBalance = useMemo(() => {
    if (typeof balance === 'undefined') {
      return <Skeleton shape="Body2" />;
    }
    return (
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
    );
  }, [balance, decimal, token.symbol]);

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
      <Token
        flex={1}
        size={8}
        showInfo
        token={token}
        showExtra={false}
        description={formatedBalance}
      />
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
