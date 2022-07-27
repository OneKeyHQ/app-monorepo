import { FC } from 'react';

import {
  Box,
  Icon,
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

import { FormatBalance, FormatCurrency } from '../../../components/Format';
import { useManageTokens } from '../../../hooks';

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
  const { prices, balances, charts } = useManageTokens();
  const { network } = useActiveWalletAccount();

  const tokenId = token.tokenIdOnNetwork || 'main';
  const balance = balances[tokenId];
  const price = prices[tokenId];

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
          {balance ? (
            <FormatBalance
              balance={balance}
              suffix={token.symbol}
              formatOptions={{
                fixed: decimal ?? 4,
              }}
              render={(ele) => (
                <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                  {ele}
                </Text>
              )}
            />
          ) : (
            <Skeleton shape={isVerticalLayout ? 'Body1' : 'Body2'} />
          )}
          {balance && price ? (
            <FormatCurrency
              numbers={[balance, price]}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          ) : (
            <Skeleton shape="Body2" />
          )}
        </Box>
        {!isVerticalLayout && !hidePriceInfo && (
          <Box mx={3} flexDirection="row" flex={1}>
            {price ? (
              <FormatCurrency
                numbers={[price]}
                render={(ele) => (
                  <Typography.Body2Strong>{ele}</Typography.Body2Strong>
                )}
              />
            ) : (
              <Skeleton shape="Body2" />
            )}
          </Box>
        )}
        <Icon size={20} name="ChevronRightSolid" />
      </Box>
    </Pressable.Item>
  );
};
TokenCell.displayName = 'TokenCell';

export default TokenCell;
