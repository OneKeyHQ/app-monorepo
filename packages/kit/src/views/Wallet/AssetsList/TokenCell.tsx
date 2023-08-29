import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
import { AppUIEventBusNames } from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import { isBRC20Token } from '@onekeyhq/shared/src/utils/tokenUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
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
import { useOnUIEventBus } from '../../../hooks/useOnUIEventBus';
import {
  CValueLoading,
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
  showTokenBalanceDetail?: boolean;
};
export type ITokenCellByKeyProps = ITokenCellSharedProps & {
  tokenKey: string;
};
type TokenCellProps = IAccountToken & ITokenCellSharedProps;

function TokenCellPrice({ price }: { price: ITokenPriceValue }) {
  return price === CValueLoading ? (
    <Skeleton shape="Body2" />
  ) : (
    <Typography.Body2Strong>
      <FormatCurrencyNumber value={0} convertValue={+(price || 0)} />
    </Typography.Body2Strong>
  );
}
const TokenCellPriceMemo = memo(TokenCellPrice);

// $backgroundApiProxy.backgroundApi.servicePrice.testUpdateTokenPriceMap()
function TokenCellPriceDeepFresh({ token }: { token: IAccountToken }) {
  const { price } = useReduxSingleTokenPriceSimple({ token });

  return <TokenCellPriceMemo price={price} />;
}

function TokenCellBalance({
  token,
  balance,
  availableBalance,
  transferBalance,
  showTokenBalanceDetail,
}: {
  token: IAccountToken;
  balance: IAmountValue;
  transferBalance: IAmountValue;
  availableBalance: IAmountValue;
  showTokenBalanceDetail?: boolean;
}) {
  const intl = useIntl();
  const { networkId, accountId, symbol } = token;
  const { network, account } = useActiveSideAccount({ accountId, networkId });
  const [recycleBalance, setRecycleBalance] = useState('0');
  const tokenId = token?.address || 'main';
  const isBRC20 = useMemo(() => isBRC20Token(tokenId), [tokenId]);

  const displayDecimal = useMemo(
    () =>
      tokenId === 'main'
        ? network?.nativeDisplayDecimals
        : network?.tokenDisplayDecimals,
    [tokenId, network?.nativeDisplayDecimals, network?.tokenDisplayDecimals],
  );

  const renderEle = useCallback(
    (ele) => <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>,
    [],
  );

  const fetchBRC20RecycleBalance = useCallback(async () => {
    if (networkId && account && token && isBRC20) {
      const resp = await backgroundApiProxy.serviceBRC20.getBRC20RecycleBalance(
        {
          networkId,
          address: account.address,
          xpub: account.xpub ?? '',
          tokenAddress: token.address ?? '',
        },
      );
      setRecycleBalance(resp);
    }
  }, [account, isBRC20, networkId, setRecycleBalance, token]);

  useEffect(() => {
    fetchBRC20RecycleBalance();
  }, [fetchBRC20RecycleBalance]);

  useOnUIEventBus(
    AppUIEventBusNames.InscriptionRecycleChanged,
    fetchBRC20RecycleBalance,
  );

  if (typeof balance === 'undefined') {
    return <Skeleton shape="Body2" />;
  }

  if (isBRC20 && showTokenBalanceDetail) {
    return (
      <Box>
        <Typography.Body2 color="text-subdued">
          {`${intl.formatMessage({ id: 'form__available_colon' })} ${
            availableBalance ?? '0'
          }`}
        </Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {`${intl.formatMessage({
            id: 'form__transferable_colon',
          })} ${BigNumber.max(
            new BigNumber(transferBalance ?? '0').minus(recycleBalance),
            '0',
          ).toFixed()}`}
        </Typography.Body2>
      </Box>
    );
  }

  return (
    <FormatBalance
      balance={BigNumber.max(
        new BigNumber(balance ?? '0').minus(recycleBalance),
        '0',
      ).toFixed()}
      suffix={symbol}
      formatOptions={{
        fixed: displayDecimal ?? 4,
      }}
      render={renderEle}
    />
  );
}

function TokenCellBalanceDeepFresh({
  token,
  showTokenBalanceDetail,
}: {
  token: IAccountToken;
  showTokenBalanceDetail?: boolean;
}) {
  const { balance, availableBalance, transferBalance } =
    useReduxSingleTokenBalanceSimple({ token });

  return (
    <TokenCellBalance
      balance={balance}
      availableBalance={availableBalance}
      transferBalance={transferBalance}
      token={token}
      showTokenBalanceDetail={showTokenBalanceDetail}
    />
  );
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

  const handlePress = useCallback(() => {
    onPress?.(token);
  }, [onPress, token]);

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
      onPress={handlePress}
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
    showTokenBalanceDetail,
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
      return (
        <TokenCellBalanceDeepFresh
          token={token}
          showTokenBalanceDetail={showTokenBalanceDetail}
        />
      );
    }
    return (
      <TokenCellBalance
        balance={token.balance}
        availableBalance={token.availableBalance}
        transferBalance={token.transferBalance}
        token={token}
        showTokenBalanceDetail={showTokenBalanceDetail}
      />
    );
  }, [deepRefreshMode, showTokenBalanceDetail, token]);

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
