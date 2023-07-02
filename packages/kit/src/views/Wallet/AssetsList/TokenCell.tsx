import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Pressable,
  Skeleton,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import { calculateGains } from '../../../utils/priceUtils';

import type { IAccountToken } from '../../Overview/types';

type TokenCellProps = IAccountToken & {
  borderTopRadius?: string | number;
  borderRadius?: string | number;
  borderTopWidth?: string | number;
  borderBottomWidth?: string | number;
  hidePriceInfo?: boolean;
  onPress?: (token: IAccountToken) => void;
  bg?: string;
  borderColor?: string;
  accountId: string;
  networkId: string;
  sendAddress?: string;
  autoDetected?: boolean;
};
const TokenCell: FC<TokenCellProps> = ({
  accountId,
  hidePriceInfo,
  borderTopRadius,
  borderRadius,
  borderBottomWidth,
  borderTopWidth,
  onPress,
  borderColor = 'border-subdued',
  bg = 'surface-default',
  ...token
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { networkId, balance, price, price24h } = token;
  const { network } = useActiveSideAccount({ accountId, networkId });
  const tokenId = token?.address || 'main';

  const { gainTextBg, percentageGain, gainTextColor } = calculateGains({
    price,
    basePrice: new BigNumber(price)
      .multipliedBy(1 - (price24h ?? 0) / 100)
      .toNumber(),
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
        suffix={token?.symbol}
        formatOptions={{
          fixed: decimal ?? 4,
        }}
        render={(ele) => (
          <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
        )}
      />
    );
  }, [balance, decimal, token?.symbol]);

  const handlePress = useCallback(
    (t: IAccountToken) => {
      onPress?.({
        ...t,
        sendAddress: token?.sendAddress,
      });
    },
    [onPress, token?.sendAddress],
  );

  if (!token) {
    return null;
  }

  return (
    <Pressable.Item
      p={4}
      bg={bg}
      shadow={undefined}
      borderTopRadius={borderTopRadius}
      borderRadius={borderRadius}
      borderWidth={1}
      borderColor={borderColor}
      borderLeftColor="border-subdued"
      borderRightColor="border-subdued"
      borderBottomColor="border-subdued"
      borderTopWidth={borderTopWidth}
      borderBottomWidth={borderBottomWidth}
      onPress={() => handlePress(token)}
      w="100%"
      flexDirection="row"
      alignItems="center"
    >
      <Box flex={1}>
        <Token
          flex="1"
          size={8}
          showInfo
          token={token}
          showExtra={false}
          description={formatedBalance}
          infoBoxProps={{ flex: 1 }}
        />
      </Box>
      {!isVerticalLayout && !hidePriceInfo && (
        <Box flexDirection="column" flex={1} alignItems="flex-end">
          {price === undefined ? (
            <Skeleton shape="Body2" />
          ) : (
            <Typography.Body2Strong>
              <FormatCurrencyNumber value={0} convertValue={+(price || 0)} />
            </Typography.Body2Strong>
          )}
        </Box>
      )}
      <Box flexDirection="column" flex={1} alignItems="flex-end">
        {tokenValue !== undefined ? (
          <>
            <Typography.Body2Strong w="100%" textAlign="right">
              <FormatCurrencyNumber value={0} convertValue={tokenValue} />
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

export default memo(TokenCell);
