import { FC } from 'react';

import { FormattedNumber } from 'react-intl';

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
import {
  useActiveWalletAccount,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';

import { FormatBalance, FormatCurrency } from '../../../components/Format';
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
  const balance = balances[tokenId];
  const chart = charts[tokenId] || [];
  let price;
  let basePrice;
  if (chart.length > 1) {
    // eslint-disable-next-line prefer-destructuring
    basePrice = chart[0][1];
    // eslint-disable-next-line prefer-destructuring
    price = chart[chart.length - 1][1];
  }

  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const { gain, isPositive, percentageGain } = calculateGains({
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
        <Box mx={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
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
          <Box mx={3} flexDirection="column" flex={1}>
            {price !== undefined ? (
              <Typography.Body2Strong>
                <FormattedNumber
                  value={price}
                  currencyDisplay="narrowSymbol"
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency={selectedFiatMoneySymbol}
                />
              </Typography.Body2Strong>
            ) : (
              <Skeleton shape="Body2" />
            )}
          </Box>
        )}
        <Box mx={3} flexDirection="column" flex={1}>
          {price !== undefined ? (
            <>
              <Typography.Body2Strong>
                <FormattedNumber
                  value={price * Number(balance)}
                  currencyDisplay="narrowSymbol"
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency={selectedFiatMoneySymbol}
                />
              </Typography.Body2Strong>
              <Box>
                <Typography.CaptionStrong>
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
