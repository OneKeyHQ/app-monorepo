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
import { withDebugRenderTracker } from '@onekeyhq/components/src/DebugRenderTracker';
import type { ITokenFiatValuesInfo } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import {
  useActiveSideAccount,
  useReduxSingleTokenBalanceSimple,
  useReduxSingleTokenFiatValuesSimple,
  useReduxSingleTokenPriceSimple,
} from '../../../hooks';
import {
  CValueLoading,
  CValueNull,
  type ITokenPriceValue,
} from '../../../store/reducers/tokens';
import { calculateGains } from '../../../utils/priceUtils';

import {
  atomHomeOverviewAccountTokens,
  useAtomAssetsList,
} from './contextAssetsList';

import type { IAmountValue } from '../../../store/reducers/tokens';
import type { IAccountToken } from '../../Overview/types';

export type ITokenCellSharedProps = {
  deepRefreshMode?: boolean;

  borderTopRadius?: string | number;
  borderRadius?: string | number;
  borderTopWidth?: string | number;
  borderBottomWidth?: string | number;
  hidePriceInfo?: boolean;
  onPress?: (token: IAccountToken) => void;
  bg?: string;
  borderColor?: string;

  autoDetected?: boolean;
  accountId: string;
  networkId: string;
  sendAddress?: string;
};
export type ITokenCellByKeyProps = ITokenCellSharedProps & {
  tokenKey: string;
};
type TokenCellProps = IAccountToken & ITokenCellSharedProps;

function TokenCellPrice({ price }: { price: ITokenPriceValue }) {
  return price === CValueLoading || price === CValueNull ? (
    <Skeleton shape="Body2" />
  ) : (
    <Typography.Body2Strong>
      {/* * price */}
      <FormatCurrencyNumber value={0} convertValue={+(price || 0)} />
    </Typography.Body2Strong>
  );
}
const TokenCellPriceMemo = memo(TokenCellPrice);

// $backgroundApiProxy.backgroundApi.servicePrice.testUpdateTokenPriceMap()
function TokenCellPriceDeepFresh({ token }: { token: IAccountToken }) {
  const { price } = useReduxSingleTokenPriceSimple({ token });

  // const { result: data } = usePromiseResult(
  //   () =>
  //     backgroundApiProxy.serviceOverview.getPriceOfTokenAsync({
  //       prices,
  //       token,
  //       // hello: 11,
  //     }),
  //   [prices, token],
  // );
  // const price = data?.price;

  return <TokenCellPriceMemo price={price} />;
}

function TokenCellBalance({
  token,
  balance,
}: {
  token: IAccountToken;
  balance: IAmountValue;
}) {
  const { networkId, accountId, address, symbol } = token;
  const { network } = useActiveSideAccount({ accountId, networkId });

  const displayDecimal = useMemo(() => {
    const tokenId = address || 'main';
    return tokenId === 'main'
      ? network?.nativeDisplayDecimals
      : network?.tokenDisplayDecimals;
  }, [network?.nativeDisplayDecimals, network?.tokenDisplayDecimals, address]);

  const renderEle = useCallback(
    (ele) => <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>,
    [],
  );

  if (typeof balance === 'undefined') {
    return <Skeleton shape="Body2" />;
  }
  return (
    <FormatBalance
      balance={balance ?? undefined}
      suffix={symbol}
      formatOptions={{
        fixed: displayDecimal ?? 4,
      }}
      render={renderEle}
    />
  );
}

// $backgroundApiProxy.backgroundApi.serviceToken.testUpdateTokensBalances()
function TokenCellBalanceDeepFresh({ token }: { token: IAccountToken }) {
  const { balance } = useReduxSingleTokenBalanceSimple({ token });

  // const { result } = usePromiseResult(
  //   () =>
  //     backgroundApiProxy.serviceOverview.getBalanceOfTokenAsync({
  //       token,
  //       balances,
  //     }),
  //   [balances, token],
  // );
  // const balance= result?.balance;

  return <TokenCellBalance balance={balance} token={token} />;
}

function TokenCellFiatValue({
  valuesInfo,
}: {
  valuesInfo: ITokenFiatValuesInfo | undefined;
}) {
  const { value, price, price24h } = valuesInfo || {
    value: undefined,
    price: undefined,
    price24h: undefined,
  };

  const { gainTextBg, percentageGain, gainTextColor } = useMemo(
    () =>
      calculateGains({
        price,
        basePrice: new BigNumber(price ?? 0)
          .multipliedBy(1 - (price24h ?? 0) / 100)
          .toNumber(),
      }),
    [price, price24h],
  );
  return value !== undefined ? (
    <>
      <Typography.Body2Strong w="100%" textAlign="right">
        {/* * value */}
        <FormatCurrencyNumber value={0} convertValue={value} />
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
  );
}
function TokenCellFiatValueDeepFresh({ token }: { token: IAccountToken }) {
  const result = useReduxSingleTokenFiatValuesSimple({
    token,
  });

  // const { result } = usePromiseResult(
  //   () =>
  //     backgroundApiProxy.serviceOverview.getValuesInfoOfTokenAsync({
  //       token,
  //       prices,
  //       balances,
  //     }),
  //   [balances, prices, token],
  //   {
  //     initResult: {
  //       value: undefined,
  //       price: undefined,
  //       price24h: undefined,
  //     },
  //   },
  // );

  return <TokenCellFiatValue valuesInfo={result} />;
}

type ITokenCellViewProps = TokenCellProps & {
  priceView: JSX.Element | null;
  balanceView: JSX.Element | null;
  valueView: JSX.Element | null;
};
function TokenCellView(props: ITokenCellViewProps) {
  const {
    priceView,
    balanceView,
    valueView,
    hidePriceInfo,
    borderTopRadius,
    borderRadius,
    borderBottomWidth,
    borderTopWidth,
    onPress,
    borderColor = 'border-subdued',
    bg = 'surface-default',
    ...token
  } = props;
  const isVerticalLayout = useIsVerticalLayout();
  const { networkId } = token;

  const handlePress = useCallback(() => {
    onPress?.(token);
  }, [onPress, token]);

  if (!token) {
    return null;
  }

  const isDisabled = networkId === OnekeyNetwork.btc && !!token.address;

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
      onPress={handlePress}
      w="100%"
      flexDirection="row"
      alignItems="center"
      isDisabled={isDisabled}
    >
      <Box flex={1}>
        <Token
          flex="1"
          size={8}
          showInfo
          token={token}
          showExtra={false}
          // * balance
          description={balanceView}
          infoBoxProps={{ flex: 1 }}
        />
      </Box>
      {!isVerticalLayout && !hidePriceInfo && (
        <Box flexDirection="column" flex={1} alignItems="flex-end">
          {
            // * price
            priceView
          }
        </Box>
      )}
      <Box flexDirection="column" flex={1} alignItems="flex-end">
        {
          // * fiatValue
          valueView
        }
      </Box>
    </Pressable.Item>
  );
}

function TokenCell(props: TokenCellProps) {
  const {
    hidePriceInfo,
    borderTopRadius,
    borderRadius,
    borderBottomWidth,
    borderTopWidth,
    onPress,
    deepRefreshMode,
    ...token
  } = props;

  const priceView = useMemo(() => {
    if (deepRefreshMode) {
      return <TokenCellPriceDeepFresh token={token} />;
    }
    return <TokenCellPrice price={token.price} />;
  }, [deepRefreshMode, token]);

  const valueView = useMemo(() => {
    if (deepRefreshMode) {
      return <TokenCellFiatValueDeepFresh token={token} />;
    }
    return <TokenCellFiatValue valuesInfo={token} />;
  }, [deepRefreshMode, token]);

  const balanceView = useMemo(() => {
    if (deepRefreshMode) {
      return <TokenCellBalanceDeepFresh token={token} />;
    }
    return <TokenCellBalance balance={token.balance} token={token} />;
  }, [deepRefreshMode, token]);

  return (
    <TokenCellView
      {...props}
      balanceView={balanceView}
      priceView={priceView}
      valueView={valueView}
    />
  );
}
TokenCell.displayName = 'TokenCell';

const TokenCellMemo = memo(withDebugRenderTracker(TokenCell));

// TODO remove
export function TokenCellByKey({ tokenKey, ...others }: ITokenCellByKeyProps) {
  const [tokensInfo] = useAtomAssetsList(atomHomeOverviewAccountTokens);
  const token = useMemo(
    () => tokensInfo.tokensMap?.[tokenKey],
    [tokenKey, tokensInfo.tokensMap],
  );

  if (!token) {
    return (
      <Box>
        <Typography.Body1>{tokenKey}</Typography.Body1>
      </Box>
    );
  }

  return <TokenCellMemo {...others} {...token} />;
}

export default TokenCellMemo;
