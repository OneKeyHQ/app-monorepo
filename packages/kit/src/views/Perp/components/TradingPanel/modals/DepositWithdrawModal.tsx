import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type { IPageNavigationProp, useInTabDialog } from '@onekeyhq/components';
import {
  Badge,
  Button,
  DashText,
  Divider,
  Icon,
  Input,
  ListView,
  Page,
  Popover,
  SegmentControl,
  SizableText,
  Skeleton,
  Toast,
  Tooltip,
  XStack,
  YStack,
  getFontSize,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IPerpsActiveAccountAtom,
  IPerpsDepositToken,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  perpsActiveAccountAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsDepositTokensAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes/receive';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  USDC_TOKEN_INFO,
  WITHDRAW_FEE,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNativeTokenConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import usePerpDeposit from '../../../hooks/usePerpDeposit';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { InputAccessoryDoneButton } from '../inputs/TradingFormInput';

import type { ListRenderItem } from 'react-native';

export type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

const DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID =
  'perp-deposit-withdraw-accessory-view';

interface IDepositWithdrawParams {
  actionType: IPerpsDepositWithdrawActionType;
}

interface IDepositWithdrawContentProps {
  params: IDepositWithdrawParams;
  selectedAccount: IPerpsActiveAccountAtom;
  onClose?: () => void;
  isMobile?: boolean;
}

function usePerpsAccountResult(selectedAccount: IPerpsActiveAccountAtom) {
  const { serviceAccount } = backgroundApiProxy;

  const { result: accountResult } = usePromiseResult(async () => {
    const isOtherAccount = accountUtils.isOthersAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    let indexedAccount: IDBIndexedAccount | undefined;
    let account: INetworkAccount | undefined;
    const wallet = await serviceAccount.getWalletSafe({
      walletId: accountUtils.getWalletIdFromAccountId({
        accountId: selectedAccount.accountId ?? '',
      }),
    });
    if (isOtherAccount && selectedAccount.accountId) {
      account = await serviceAccount.getAccount({
        accountId: selectedAccount.accountId,
        networkId: PERPS_NETWORK_ID,
      });
    } else if (selectedAccount.indexedAccountId) {
      indexedAccount = await serviceAccount.getIndexedAccount({
        id: selectedAccount.indexedAccountId,
      });
    }

    return { wallet, account, indexedAccount, isOtherAccount };
  }, [
    selectedAccount.indexedAccountId,
    selectedAccount.accountId,
    serviceAccount,
  ]);

  return accountResult;
}
function PerpsAccountAvatar({
  selectedAccount,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
}) {
  const accountResult = usePerpsAccountResult(selectedAccount);

  if (!accountResult) return null;

  return (
    <XStack alignItems="center" gap="$2" pb="$3">
      <AccountAvatar
        size="small"
        account={
          accountResult.isOtherAccount ? accountResult.account : undefined
        }
        indexedAccount={
          accountResult.isOtherAccount
            ? undefined
            : accountResult.indexedAccount
        }
        wallet={accountResult.wallet}
      />
      <XStack flex={1} minWidth={0} maxWidth="70%" overflow="hidden">
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {accountResult?.isOtherAccount
            ? accountResult?.account?.name
            : accountResult?.indexedAccount?.name}
        </SizableText>
      </XStack>
    </XStack>
  );
}
PerpsAccountAvatar.displayName = 'PerpsAccountAvatar';

function SelectTokenPopoverContent({
  symbol,
  depositTokensWithPrice,
  handleSwitchToTradePress,
  handleMaxPress,
}: {
  depositTokensWithPrice: IPerpsDepositToken[];
  symbol: string;
  handleSwitchToTradePress: () => void;
  handleMaxPress: (params?: {
    networkId: string;
    isNative: boolean;
    amount: string;
    symbol: string;
    decimals: number;
  }) => void;
}) {
  const intl = useIntl();
  const { closePopover } = usePopoverContext();
  const [, setPerpsDepositTokensAtom] = usePerpsDepositTokensAtom();
  const renderTokenItem = useCallback<ListRenderItem<IPerpsDepositToken>>(
    ({ item }) => {
      const balanceFormatted = numberFormat(item.balanceParsed ?? '0', {
        formatter: 'balance',
      });
      const fiatValueFormatted = numberFormat(item.fiatValue ?? '0', {
        formatter: 'value',
        formatterOptions: { currency: symbol },
      });
      const isArbUSDC = equalTokenNoCaseSensitive({
        token1: item,
        token2: {
          networkId: PERPS_NETWORK_ID,
          contractAddress: USDC_TOKEN_INFO.address,
        },
      });
      const networkInfo = networkUtils.getLocalNetworkInfo(item.networkId);
      const networkName = networkInfo?.name;
      return (
        <ListItem
          justifyContent="space-between"
          py="$2"
          onPress={() => {
            setPerpsDepositTokensAtom((prev) => ({
              ...prev,
              currentPerpsDepositSelectedToken: item,
            }));
            handleMaxPress?.({
              networkId: item.networkId,
              isNative: !!item.isNative,
              amount: item.balanceParsed || '0',
              symbol: item.symbol ?? '',
              decimals: item.decimals,
            });
            void closePopover?.();
          }}
        >
          <XStack gap="$2" alignItems="center">
            <Token
              tokenImageUri={item.logoURI}
              networkImageUri={item.networkLogoURI}
              showNetworkIcon
              size="md"
            />
            <YStack>
              <SizableText size="$bodySmMedium">{item.symbol}</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {networkName}
              </SizableText>
            </YStack>
            {isArbUSDC ? (
              <Badge
                badgeSize="sm"
                height={24}
                borderRadius="$full"
                borderColor="$borderInfo"
                bg="$bgInfo"
                px="$2.5"
              >
                <SizableText size="$bodySm" color="$textInfo">
                  {intl.formatMessage({
                    id: ETranslations.perp_deposit_direct,
                  })}
                </SizableText>
              </Badge>
            ) : null}
          </XStack>
          <YStack alignItems="flex-end">
            <SizableText size="$bodySmMedium">{balanceFormatted}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {fiatValueFormatted}
            </SizableText>
          </YStack>
        </ListItem>
      );
    },
    [symbol, setPerpsDepositTokensAtom, closePopover, handleMaxPress, intl],
  );
  return (
    <YStack>
      <ListView
        contentContainerStyle={{
          borderRadius: 12,
          py: '$3',
        }}
        data={depositTokensWithPrice}
        renderItem={renderTokenItem}
      />
      <XStack
        bg="$bgSubdued"
        borderBottomLeftRadius={12}
        borderBottomRightRadius={12}
        justifyContent="center"
        borderTopWidth={1}
        borderTopColor="$borderSubdued"
        p="$2"
        cursor="pointer"
        onPress={() => {
          void closePopover?.();
          if (platformEnv.isNativeIOS) {
            setTimeout(() => {
              handleSwitchToTradePress?.();
            }, 100);
            return;
          }
          handleSwitchToTradePress?.();
        }}
      >
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: ETranslations.dexmarket_switch_to_trade })}
          <SizableText fontWeight="bold" color="$textSuccess">
            {intl.formatMessage({ id: ETranslations.global_trade })}
          </SizableText>
        </SizableText>
      </XStack>
    </YStack>
  );
}

function DepositWithdrawContent({
  params,
  selectedAccount,
  onClose,
  isMobile,
}: IDepositWithdrawContentProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const accountValue = accountSummary?.accountValue ?? '';
  const withdrawable = accountSummary?.withdrawable ?? '';
  const [selectedAction, setSelectedAction] =
    useState<IPerpsDepositWithdrawActionType>(params.actionType);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinAmountError, setShowMinAmountError] = useState(false);
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const unrealizedPnl = accountSummary?.totalUnrealizedPnl ?? '0';
  const unrealizedPnlInfo = useMemo(() => {
    const pnlBn = new BigNumber(unrealizedPnl || '0');
    const pnlAbs = pnlBn.abs().toFixed();
    const pnlFormatted = numberFormat(pnlAbs, {
      formatter: 'value',
      formatterOptions: {
        currency: '$',
      },
    });
    let pnlColor = '$text';
    if (!pnlBn.isZero()) {
      pnlColor = pnlBn.lt(0) ? '$red11' : '$green11';
    }
    let pnlPlusOrMinus = '';
    if (!pnlBn.isZero()) {
      pnlPlusOrMinus = pnlBn.lt(0) ? '-' : '+';
    }
    return { pnlFormatted, pnlColor, pnlPlusOrMinus };
  }, [unrealizedPnl]);
  const [
    { tokens, currentPerpsDepositSelectedToken },
    setPerpsDepositTokensAtom,
  ] = usePerpsDepositTokensAtom();

  const tokensRef = useRef<Record<string, IPerpsDepositToken[]>>(tokens);
  if (tokensRef.current !== tokens) {
    tokensRef.current = tokens;
  }
  const currentPerpsDepositSelectedTokenRef = useRef<
    IPerpsDepositToken | undefined
  >(currentPerpsDepositSelectedToken);
  if (
    currentPerpsDepositSelectedTokenRef.current?.contractAddress !==
    currentPerpsDepositSelectedToken?.contractAddress
  ) {
    currentPerpsDepositSelectedTokenRef.current =
      currentPerpsDepositSelectedToken;
  }

  const [depositTokensWithPrice, setDepositTokensWithPrice] = useState<
    IPerpsDepositToken[]
  >([]);
  const [nativeTokenConfigs, setNativeTokenConfigs] = useState<
    ISwapNativeTokenConfig[]
  >([]);
  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const handleSwitchToTradePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        swapSource: ESwapSource.PERP,
      },
    });
  }, [navigation]);

  const accountResult = usePerpsAccountResult(selectedAccount);

  const handleBuyPress = useCallback(async () => {
    if (!currentPerpsDepositSelectedToken || !accountResult) {
      return;
    }

    await dismissKeyboardWithDelay();

    defaultLogger.wallet.walletActions.buyOnLowBalance({
      source: 'perp',
      networkId: currentPerpsDepositSelectedToken.networkId ?? '',
      tokenSymbol: currentPerpsDepositSelectedToken.symbol ?? '',
      tokenAddress: currentPerpsDepositSelectedToken.contractAddress ?? '',
      walletType: accountResult.wallet?.type ?? '',
    });

    const navParams = {
      accountId: selectedAccount.accountId ?? '',
      networkId: currentPerpsDepositSelectedToken.networkId ?? '',
      walletId: accountResult.wallet?.id ?? '',
      indexedAccountId: selectedAccount.indexedAccountId,
      token: {
        networkId: currentPerpsDepositSelectedToken.networkId ?? '',
        address: currentPerpsDepositSelectedToken.contractAddress ?? '',
        name: currentPerpsDepositSelectedToken.name ?? '',
        symbol: currentPerpsDepositSelectedToken.symbol ?? '',
        decimals: currentPerpsDepositSelectedToken.decimals,
        logoURI: currentPerpsDepositSelectedToken.logoURI,
        isNative: currentPerpsDepositSelectedToken.isNative,
      },
    };

    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: navParams,
    });
  }, [
    navigation,
    currentPerpsDepositSelectedToken,
    selectedAccount,
    accountResult,
  ]);

  const checkAccountSupport = useMemo(() => {
    const isWatchingAccount = accountUtils.isWatchingAccount({
      accountId: selectedAccount.accountId || '',
    });
    return !isWatchingAccount;
  }, [selectedAccount.accountId]);

  const { result, isLoading: balanceLoading } = usePromiseResult(
    async () => {
      if (
        !selectedAccount.accountId ||
        !selectedAccount.accountAddress ||
        !checkAccountSupport
      ) {
        return [];
      }
      try {
        const tokensList = Object.values(tokensRef.current).flat() || [];
        const networkIds = Object.keys(tokensRef.current) || [];
        const tokenDetailsAndNativeTokenConfigs = await Promise.all(
          networkIds.map(async (networkId) => {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId,
                },
              );
            let tokenDetails: ISwapToken[] | undefined;
            let nativeTokenConfig: ISwapNativeTokenConfig | undefined;
            try {
              const accountAddressInfo =
                await backgroundApiProxy.serviceAccount.getNetworkAccount({
                  indexedAccountId: selectedAccount.indexedAccountId ?? '',
                  networkId,
                  deriveType: defaultDeriveType ?? 'default',
                  accountId: selectedAccount.indexedAccountId
                    ? undefined
                    : selectedAccount.accountId ?? '',
                });
              const [tokenDetailsRes, nativeTokenConfigRes] = await Promise.all(
                [
                  backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                    networkId,
                    contractAddress:
                      tokensRef.current?.[networkId]
                        ?.map((token) => token.contractAddress)
                        .join(',') || '',
                    accountAddress: accountAddressInfo.addressDetail.address,
                    accountId: accountAddressInfo.id ?? '',
                  }),
                  backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
                    networkId,
                  }),
                ],
              );
              tokenDetails = tokenDetailsRes;
              nativeTokenConfig = nativeTokenConfigRes;
            } catch (e) {
              console.error(
                '[DepositWithdrawModal] Failed to fetch tokens balance:',
                e,
              );
            }
            return {
              tokenDetails,
              nativeTokenConfig,
            };
          }),
        );
        const tokenDetails =
          tokenDetailsAndNativeTokenConfigs
            ?.map((t) => t.tokenDetails)
            .flat()
            .filter(Boolean) ?? [];
        const nativeTokenConfigsRes =
          tokenDetailsAndNativeTokenConfigs
            ?.map((t) => t.nativeTokenConfig)
            .flat()
            .filter(Boolean) ?? [];
        setNativeTokenConfigs(nativeTokenConfigsRes);
        if (tokenDetails) {
          const depositTokensWithPriceRes = tokensList
            .filter((originToken) =>
              tokenDetails.find((t) =>
                equalTokenNoCaseSensitive({ token1: t, token2: originToken }),
              ),
            )
            .map((token) => ({
              ...token,
              balanceParsed: tokenDetails.find((t) =>
                equalTokenNoCaseSensitive({ token1: t, token2: token }),
              )?.balanceParsed,
              price: tokenDetails.find((t) =>
                equalTokenNoCaseSensitive({ token1: t, token2: token }),
              )?.price,
              fiatValue: tokenDetails.find((t) =>
                equalTokenNoCaseSensitive({ token1: t, token2: token }),
              )?.fiatValue,
            }))
            .sort((a, b) =>
              new BigNumber(b.fiatValue ?? 0).comparedTo(
                new BigNumber(a.fiatValue ?? 0),
              ),
            );
          setDepositTokensWithPrice(depositTokensWithPriceRes);
          return depositTokensWithPriceRes;
        }
      } catch (error) {
        console.error(
          '[DepositWithdrawModal] Failed to fetch tokens balance:',
          error,
        );
        setDepositTokensWithPrice([]);
        setPerpsDepositTokensAtom((prev) => ({
          ...prev,
          currentPerpsDepositSelectedToken: undefined,
        }));
        return [];
      }
    },
    [
      selectedAccount.accountId,
      selectedAccount.accountAddress,
      selectedAccount.indexedAccountId,
      checkAccountSupport,
      setPerpsDepositTokensAtom,
    ],
    {
      watchLoading: true,
      checkIsMounted: true,
      revalidateOnFocus: true,
      debounced: 1000,
    },
  );

  const { normalizeTxConfirm } = useSignatureConfirm({
    accountId: selectedAccount.accountId || '',
    networkId: currentPerpsDepositSelectedToken?.networkId || '',
  });

  useEffect(() => {
    if (result) {
      const findToken = result.find((t) =>
        equalTokenNoCaseSensitive({
          token1: t,
          token2: currentPerpsDepositSelectedTokenRef.current,
        }),
      );
      if (currentPerpsDepositSelectedTokenRef.current && findToken) {
        setPerpsDepositTokensAtom((prev) => ({
          ...prev,
          currentPerpsDepositSelectedToken: {
            ...currentPerpsDepositSelectedTokenRef.current,
            networkId: findToken?.networkId,
            contractAddress: findToken?.contractAddress,
            name: findToken?.name,
            symbol: findToken?.symbol,
            decimals: findToken?.decimals,
            networkLogoURI: findToken?.networkLogoURI,
            logoURI: findToken?.logoURI,
            isNative: findToken?.isNative,
            balanceParsed: findToken?.balanceParsed,
            fiatValue: findToken?.fiatValue,
            price: findToken?.price,
          },
        }));
      }
    }
  }, [result, setPerpsDepositTokensAtom]);

  const availableBalance = useMemo(() => {
    const rawBalance =
      selectedAction === 'withdraw'
        ? withdrawable || '0'
        : currentPerpsDepositSelectedToken?.balanceParsed ?? '0';
    const balanceFormatted = numberFormat(rawBalance, { formatter: 'balance' });
    const displayBalance =
      selectedAction === 'withdraw'
        ? `${balanceFormatted} ${USDC_TOKEN_INFO.symbol}`
        : `${balanceFormatted} ${
            currentPerpsDepositSelectedToken?.symbol ?? ''
          }`;
    return {
      balance: rawBalance,
      displayBalance,
    };
  }, [
    selectedAction,
    withdrawable,
    currentPerpsDepositSelectedToken?.balanceParsed,
    currentPerpsDepositSelectedToken?.symbol,
  ]);

  const amountBN = useMemo(() => new BigNumber(amount || '0'), [amount]);

  const availableBalanceBN = useMemo(
    () => new BigNumber(availableBalance.balance || '0'),
    [availableBalance.balance],
  );

  const checkFromTokenFiatValue = useMemo(() => {
    const fromTokenPrice = currentPerpsDepositSelectedToken?.price;
    const fromTokenPriceBN = new BigNumber(fromTokenPrice || '0');
    if (fromTokenPriceBN.isZero() || fromTokenPriceBN.isNaN()) {
      return {
        value: false,
        minFromTokenAmount: '-',
      };
    }
    const arbUSDCToken = depositTokensWithPrice.find((token) =>
      equalTokenNoCaseSensitive({
        token1: token,
        token2: {
          networkId: PERPS_NETWORK_ID,
          contractAddress: USDC_TOKEN_INFO.address,
        },
      }),
    );
    const arbUSDCTokenMinAmount = new BigNumber(
      arbUSDCToken?.price ?? '0',
    ).multipliedBy(MIN_DEPOSIT_AMOUNT);
    const minFromTokenAmount =
      arbUSDCTokenMinAmount.dividedBy(fromTokenPriceBN);
    if (
      minFromTokenAmount.isPositive() &&
      !minFromTokenAmount?.isNaN() &&
      minFromTokenAmount.lte(amountBN)
    ) {
      return {
        value: true,
      };
    }
    const minFromTokenAmountFormatted = minFromTokenAmount
      .decimalPlaces(
        currentPerpsDepositSelectedToken?.decimals ?? 0,
        BigNumber.ROUND_UP,
      )
      .toFixed();
    return {
      value: false,
      minFromTokenAmount: minFromTokenAmountFormatted,
    };
  }, [
    amountBN,
    currentPerpsDepositSelectedToken?.decimals,
    currentPerpsDepositSelectedToken?.price,
    depositTokensWithPrice,
  ]);

  const isValidAmount = useMemo(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(availableBalanceBN) &&
        (!showMinAmountError || checkFromTokenFiatValue.value)
      );
    }

    if (selectedAction === 'withdraw') {
      return (
        amountBN.lte(availableBalanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_WITHDRAW_AMOUNT))
      );
    }

    return true;
  }, [
    amountBN,
    availableBalanceBN,
    selectedAction,
    showMinAmountError,
    checkFromTokenFiatValue.value,
  ]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinAmountError && !checkFromTokenFiatValue.value) {
        return intl.formatMessage(
          { id: ETranslations.perp_mini_deposit },
          {
            num: checkFromTokenFiatValue.minFromTokenAmount,
            token: currentPerpsDepositSelectedToken?.symbol ?? '-',
          },
        );
      }
    }

    if (selectedAction === 'withdraw') {
      if (showMinAmountError && amountBN.lt(MIN_WITHDRAW_AMOUNT)) {
        return intl.formatMessage(
          { id: ETranslations.perp_mini_withdraw },
          { num: MIN_WITHDRAW_AMOUNT, token: 'USDC' },
        );
      }
    }

    return '';
  }, [
    amount,
    amountBN,
    selectedAction,
    showMinAmountError,
    checkFromTokenFiatValue.value,
    checkFromTokenFiatValue.minFromTokenAmount,
    intl,
    currentPerpsDepositSelectedToken?.symbol,
  ]);

  const {
    perpDepositQuote,
    perpDepositQuoteLoading,
    buildPerpDepositTx,
    multipleStepText,
    isArbitrumUsdcToken,
    shouldApprove,
    shouldResetApprove,
    checkRefreshQuote,
    perpDepositQuoteAction,
    handlePerpDepositTxSuccess,
  } = usePerpDeposit(
    amount,
    selectedAction,
    selectedAccount.indexedAccountId ?? '',
    selectedAccount.accountId ?? '',
    currentPerpsDepositSelectedToken,
    checkFromTokenFiatValue.value,
  );

  const handleAmountChange = useCallback(
    (value: string) => {
      if (
        validateAmountInput(value, currentPerpsDepositSelectedToken?.decimals)
      ) {
        setAmount(value);
      }
    },
    [currentPerpsDepositSelectedToken?.decimals],
  );
  const calculateFinalAmount = (withdrawFee: number): string => {
    const finalResult = new BigNumber(amount || '0').minus(
      selectedAction === 'withdraw' ? withdrawFee : 0,
    );

    return finalResult.isPositive() && !finalResult?.isNaN()
      ? finalResult.toFixed()
      : '0';
  };
  const handleAmountBlur = useCallback(() => {
    if (amount && !amountBN.isNaN() && amountBN.gt(0)) {
      if (selectedAction === 'deposit' && !checkFromTokenFiatValue.value) {
        setShowMinAmountError(true);
      } else if (
        selectedAction === 'withdraw' &&
        amountBN.lt(MIN_WITHDRAW_AMOUNT)
      ) {
        setShowMinAmountError(true);
      }
    }
  }, [amount, amountBN, selectedAction, checkFromTokenFiatValue.value]);

  const checkNativeTokenGasToast = useCallback(
    (
      isNative?: boolean,
      tokenNetworkId?: string,
      tokenBalance?: string,
      tokenSymbol?: string,
      tokenDecimals?: number,
    ) => {
      let maxAmount = new BigNumber(tokenBalance || 0);
      if (isNative) {
        const reserveGas = nativeTokenConfigs.find(
          (item) => item.networkId === tokenNetworkId,
        )?.reserveGas;
        if (reserveGas) {
          maxAmount = BigNumber.max(
            0,
            maxAmount.minus(new BigNumber(reserveGas)),
          ).decimalPlaces(tokenDecimals ?? 6, BigNumber.ROUND_DOWN);
        }
        let reserveGasFormatted: string | undefined | number = reserveGas;
        if (reserveGas) {
          reserveGasFormatted = numberFormat(reserveGas.toString(), {
            formatter: 'balance',
            formatterOptions: {
              tokenSymbol,
            },
          });
        }
        const message = intl.formatMessage(
          {
            id: reserveGasFormatted
              ? ETranslations.swap_native_token_max_tip_already
              : ETranslations.swap_native_token_max_tip,
          },
          {
            num_token: reserveGasFormatted,
          },
        );
        Toast.message({
          title: message,
        });
      }
      return maxAmount;
    },
    [nativeTokenConfigs, intl],
  );

  const handleMaxPress = useCallback(
    (tokenParams?: {
      networkId: string;
      isNative: boolean;
      amount: string;
      symbol: string;
      decimals: number;
    }) => {
      if (tokenParams && selectedAction === 'deposit') {
        const maxAmount = checkNativeTokenGasToast(
          tokenParams.isNative,
          tokenParams.networkId,
          tokenParams.amount,
          tokenParams.symbol,
          tokenParams.decimals,
        );
        setAmount(maxAmount.toFixed());
        return;
      }
      if (availableBalance) {
        setAmount(availableBalance.balance || '0');
      }
    },
    [availableBalance, checkNativeTokenGasToast, selectedAction],
  );

  useEffect(() => {
    if (selectedAction === 'deposit' && !checkFromTokenFiatValue.value) {
      setShowMinAmountError(true);
    }
  }, [selectedAction, checkFromTokenFiatValue.value, amount]);

  const validateAmountBeforeSubmit = useCallback(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.dexmarket_enter_amount }),
      });
      return false;
    }

    if (amountBN.gt(availableBalanceBN)) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.earn_insufficient_balance,
        }),
      });
      return false;
    }

    if (selectedAction === 'deposit' && !checkFromTokenFiatValue.value) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_mini_deposit },
        {
          num: checkFromTokenFiatValue.minFromTokenAmount,
          token: currentPerpsDepositSelectedToken?.symbol ?? '-',
        },
      );
      Toast.error({ title: message });
      return false;
    }

    if (selectedAction === 'withdraw' && amountBN.lt(MIN_WITHDRAW_AMOUNT)) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_mini_withdraw },
        { num: MIN_WITHDRAW_AMOUNT, token: 'USDC' },
      );
      Toast.error({ title: message });
      return false;
    }

    if (showMinAmountError) {
      setShowMinAmountError(false);
    }

    return true;
  }, [
    amountBN,
    availableBalanceBN,
    checkFromTokenFiatValue.minFromTokenAmount,
    checkFromTokenFiatValue.value,
    currentPerpsDepositSelectedToken?.symbol,
    intl,
    selectedAction,
    showMinAmountError,
  ]);

  const leftContent = useMemo(() => {
    return selectedAction === 'deposit' ? (
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `$${MIN_DEPOSIT_AMOUNT}` },
        )}
      </SizableText>
    ) : (
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `${MIN_WITHDRAW_AMOUNT} USDC` },
        )}
      </SizableText>
    );
  }, [intl, selectedAction]);

  const handleConfirm = useCallback(async () => {
    if (!isValidAmount || !selectedAccount.accountAddress) return;

    const canSubmit = validateAmountBeforeSubmit();
    if (!canSubmit) return;

    try {
      if (checkRefreshQuote) {
        void perpDepositQuoteAction();
        return;
      }
      setIsSubmitting(true);
      if (selectedAction === 'deposit') {
        if (isArbitrumUsdcToken) {
          await normalizeTxConfirm({
            onSuccess: async (data: ISendTxOnSuccessData[]) => {
              await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
              if (data?.[0]) {
                const fromTxId = data[0].signedTx.txid;
                const usdcToken = {
                  networkId: PERPS_NETWORK_ID,
                  contractAddress: USDC_TOKEN_INFO.address,
                  name: USDC_TOKEN_INFO.name,
                  symbol: USDC_TOKEN_INFO.symbol,
                  decimals: USDC_TOKEN_INFO.decimals,
                  networkLogoURI:
                    swapDefaultSetTokens[PERPS_NETWORK_ID].toToken
                      ?.networkLogoURI ?? '',
                };
                void handlePerpDepositTxSuccess({
                  fromToken:
                    currentPerpsDepositSelectedTokenRef.current ?? usdcToken,
                  fromTxId,
                  toAmount: amount,
                  fromAmount: amount,
                  isArbUSDCOrder: true,
                });
              }
              onClose?.();
            },
            transfersInfo: [
              {
                from: selectedAccount.accountAddress,
                to: HYPERLIQUID_DEPOSIT_ADDRESS,
                amount,
                tokenInfo: USDC_TOKEN_INFO,
              },
            ],
          });
        } else {
          await buildPerpDepositTx();
          onClose?.();
        }
      } else {
        await withdraw({
          userAccountId: selectedAccount.accountId || '',
          amount,
          destination: selectedAccount.accountAddress,
        });
        onClose?.();
      }
    } catch (error) {
      console.error(`[DepositWithdrawModal.${selectedAction}] Failed:`, error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidAmount,
    selectedAccount.accountAddress,
    selectedAccount.accountId,
    validateAmountBeforeSubmit,
    checkRefreshQuote,
    selectedAction,
    perpDepositQuoteAction,
    isArbitrumUsdcToken,
    normalizeTxConfirm,
    amount,
    handlePerpDepositTxSuccess,
    onClose,
    buildPerpDepositTx,
    withdraw,
  ]);

  const nativeInputProps = platformEnv.isNativeIOS
    ? { inputAccessoryViewID: DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID }
    : {};

  const isInsufficientBalance = useMemo(() => {
    return amountBN.gt(availableBalanceBN) && amountBN.gt(0);
  }, [amountBN, availableBalanceBN]);

  const accountTypeInfo = useMemo(() => {
    const isHwWallet = accountUtils.isHwAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    return {
      isHwWallet,
      isExternalAccount,
    };
  }, [selectedAccount.accountId]);

  const buttonText = useMemo(() => {
    if (isInsufficientBalance)
      return intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    let depositActionText = intl.formatMessage({
      id: ETranslations.perp_trade_deposit,
    });
    if (multipleStepText) {
      depositActionText = multipleStepText;
    }
    if (shouldApprove) {
      depositActionText = intl.formatMessage({
        id: ETranslations.perp_lifi_deposit_approve,
      });
      if (accountTypeInfo.isHwWallet) {
        depositActionText = intl.formatMessage({
          id: shouldResetApprove
            ? ETranslations.swap_review_confirm_3_on_device
            : ETranslations.swap_review_confirm_2_on_device,
        });
      }
      if (accountTypeInfo.isExternalAccount) {
        depositActionText = intl.formatMessage({
          id: shouldResetApprove
            ? ETranslations.swap_review_confirm_3_on_wallet
            : ETranslations.swap_review_confirm_2_on_wallet,
        });
      }
    }
    if (checkRefreshQuote) {
      depositActionText = intl.formatMessage({
        id: ETranslations.swap_page_button_refresh_quotes,
      });
    }
    if (perpDepositQuoteLoading) {
      depositActionText = intl.formatMessage({
        id: ETranslations.swap_page_button_fetching_quotes,
      });
    }
    return selectedAction === 'deposit'
      ? depositActionText
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [
    isInsufficientBalance,
    intl,
    multipleStepText,
    shouldApprove,
    checkRefreshQuote,
    perpDepositQuoteLoading,
    selectedAction,
    accountTypeInfo.isHwWallet,
    accountTypeInfo.isExternalAccount,
    shouldResetApprove,
  ]);

  const shouldShowBuyButton = useMemo(
    () =>
      !errorMessage &&
      isInsufficientBalance &&
      selectedAction === 'deposit' &&
      checkAccountSupport &&
      !balanceLoading,
    [
      errorMessage,
      isInsufficientBalance,
      selectedAction,
      checkAccountSupport,
      balanceLoading,
    ],
  );

  useEffect(() => {
    if (!currentPerpsDepositSelectedToken) {
      const arbUSDCToken = depositTokensWithPrice.find((token) =>
        equalTokenNoCaseSensitive({
          token1: token,
          token2: {
            networkId: PERPS_NETWORK_ID,
            contractAddress: USDC_TOKEN_INFO.address,
          },
        }),
      );
      setPerpsDepositTokensAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedToken:
          arbUSDCToken ?? depositTokensWithPrice?.[0],
      }));
    } else if (!checkAccountSupport) {
      setPerpsDepositTokensAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedToken: undefined,
      }));
    }
  }, [
    depositTokensWithPrice,
    currentPerpsDepositSelectedToken,
    setPerpsDepositTokensAtom,
    checkAccountSupport,
  ]);

  const depositTokenSelectComponent = useMemo(() => {
    if (balanceLoading && checkAccountSupport)
      return <Skeleton w={40} h={14} radius="round" />;
    if (depositTokensWithPrice.length === 0)
      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          -
        </SizableText>
      );
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        })}
        sheetProps={{
          snapPoints: [80],
          snapPointsMode: 'percent',
        }}
        floatingPanelProps={{
          maxHeight: 400,
          width: 352,
        }}
        placement="bottom-end"
        offset={{ mainAxis: 10, crossAxis: 12 }}
        renderTrigger={
          <XStack alignItems="center" gap="$1" cursor="pointer">
            <SizableText size="$bodyMd" color="$textSubdued">
              {currentPerpsDepositSelectedToken?.symbol ?? '-'}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
              size="$5"
            />
          </XStack>
        }
        renderContent={
          <SelectTokenPopoverContent
            symbol={settingsPersistAtom.currencyInfo?.symbol}
            depositTokensWithPrice={depositTokensWithPrice}
            handleSwitchToTradePress={handleSwitchToTradePress}
            handleMaxPress={handleMaxPress}
          />
        }
      />
    );
  }, [
    handleMaxPress,
    handleSwitchToTradePress,
    balanceLoading,
    intl,
    currentPerpsDepositSelectedToken?.symbol,
    settingsPersistAtom.currencyInfo?.symbol,
    depositTokensWithPrice,
    checkAccountSupport,
  ]);

  const depositToAmount = useMemo(() => {
    let depositToAmountRes = '0';
    if (isArbitrumUsdcToken) {
      depositToAmountRes = amountBN.toFixed();
    } else {
      depositToAmountRes = perpDepositQuote?.result?.toAmount ?? '0';
    }
    const depositToAmountBN = new BigNumber(depositToAmountRes);
    return {
      value: depositToAmountRes,
      canDeposit: depositToAmountBN.gt(0) && !depositToAmountBN.isNaN(),
    };
  }, [isArbitrumUsdcToken, amountBN, perpDepositQuote?.result?.toAmount]);

  const currentNetworkInfo = useMemo(() => {
    if (!currentPerpsDepositSelectedToken?.networkId) return null;
    return networkUtils.getLocalNetworkInfo(
      currentPerpsDepositSelectedToken?.networkId ?? '',
    );
  }, [currentPerpsDepositSelectedToken?.networkId]);

  const onChangeSegmentControl = useCallback(
    (value: string | number) => {
      setAmount('');
      if (showMinAmountError) {
        setShowMinAmountError(false);
      }
      setSelectedAction(value as IPerpsDepositWithdrawActionType);
    },
    [showMinAmountError],
  );

  const content = (
    <YStack
      gap="$4"
      px="$1"
      pt="$1"
      style={{
        marginTop: isMobile ? 0 : -22,
      }}
    >
      <YStack gap="$2.5">
        {isMobile ? null : (
          <PerpsAccountAvatar selectedAccount={selectedAccount} />
        )}
        <YStack bg="$bgSubdued" borderRadius="$3">
          <XStack
            alignItems="center"
            gap="$2"
            justifyContent="space-between"
            py="$3"
            px="$4"
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_account_panel_account_value,
              })}
            </SizableText>
            <PerpsAccountNumberValue
              value={accountValue}
              skeletonWidth={120}
              textSize="$bodyMdMedium"
            />
          </XStack>
          <Divider borderWidth="$0.3" borderColor="$bgApp" />
          <XStack
            alignItems="center"
            gap="$2"
            justifyContent="space-between"
            py="$3"
            px="$4"
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_account_unrealized_pnl,
              })}
            </SizableText>
            <SizableText
              size="$bodyMdMedium"
              color={unrealizedPnlInfo.pnlColor}
            >
              {`${unrealizedPnlInfo.pnlPlusOrMinus}${unrealizedPnlInfo.pnlFormatted}`}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
      <SegmentControl
        height={38}
        segmentControlItemStyleProps={{
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
        }}
        value={selectedAction}
        onChange={onChangeSegmentControl}
        options={[
          {
            label: intl.formatMessage({
              id: ETranslations.perp_trade_deposit,
            }),
            value: 'deposit',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_trade_withdraw,
            }),
            value: 'withdraw',
          },
        ]}
      />

      <YStack gap="$2">
        <XStack
          borderWidth="$px"
          borderColor={
            errorMessage || isInsufficientBalance ? '$red7' : '$borderSubdued'
          }
          borderRadius="$3"
          px="$3"
          bg="$bgSubdued"
          alignItems="center"
          gap="$3"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.send_nft_amount })}
          </SizableText>
          <Input
            alignItems="center"
            flex={1}
            placeholder={intl.formatMessage({
              id: ETranslations.form_amount_placeholder,
            })}
            value={amount}
            onChangeText={handleAmountChange}
            onBlur={handleAmountBlur}
            keyboardType="decimal-pad"
            disabled={isSubmitting}
            readonly={!checkAccountSupport}
            borderWidth={0}
            size="medium"
            fontSize={getFontSize('$bodyMd')}
            {...nativeInputProps}
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: 'transparent',
              p: 0,
            }}
            InputComponentStyle={{
              p: 0,
              bg: 'transparent',
              justifyContent: 'flex-end',
            }}
            textAlign="right"
            addOnsContainerProps={{
              justifyContent: 'flex-end',
              alignItems: 'center',
              ml: '$2',
            }}
            {...(selectedAction === 'deposit'
              ? {
                  addOns: [
                    {
                      renderContent: depositTokenSelectComponent,
                    },
                  ],
                }
              : {})}
          />
        </XStack>

        {errorMessage ? (
          <SizableText size="$bodySm" color="$red10">
            {errorMessage}
          </SizableText>
        ) : null}
        {shouldShowBuyButton ? (
          <XStack gap="$1" alignItems="center">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.perps_buy_tip },
                { token: currentPerpsDepositSelectedToken?.symbol ?? '' },
              )}
            </SizableText>

            <DashText
              onPress={handleBuyPress}
              color="$textSuccess"
              size="$bodySmMedium"
              cursor="pointer"
              dashColor="$textSuccess"
            >
              {intl.formatMessage({ id: ETranslations.global_top_up })}
            </DashText>
          </XStack>
        ) : null}
      </YStack>
      {/* Available Balance & You Will Get */}
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {selectedAction === 'withdraw'
              ? intl.formatMessage({
                  id: ETranslations.perp_account_panel_withrawable_value,
                })
              : intl.formatMessage({
                  id: ETranslations.perp_available_balance,
                })}
          </SizableText>
          <XStack alignItems="center" gap="$2">
            {balanceLoading && checkAccountSupport ? (
              <Skeleton w={80} h={14} />
            ) : (
              <>
                <SizableText size="$bodyMd" color="$text">
                  {availableBalance.displayBalance || '0.00'}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textSuccess"
                  cursor="pointer"
                  onPress={() => {
                    handleMaxPress({
                      networkId:
                        currentPerpsDepositSelectedToken?.networkId ?? '',
                      isNative: !!currentPerpsDepositSelectedToken?.isNative,
                      amount:
                        currentPerpsDepositSelectedToken?.balanceParsed || '0',
                      symbol: currentPerpsDepositSelectedToken?.symbol ?? '',
                      decimals: currentPerpsDepositSelectedToken?.decimals ?? 6,
                    });
                  }}
                >
                  Max
                </SizableText>
              </>
            )}
          </XStack>
        </XStack>
        {selectedAction === 'deposit' ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_deposit_chain,
              })}
            </SizableText>
            <XStack alignItems="center" gap="$2">
              <SizableText size="$bodyMd" color="$text">
                {currentNetworkInfo?.name}
              </SizableText>
            </XStack>
          </XStack>
        ) : null}
        {selectedAction === 'withdraw' ? (
          <XStack justifyContent="space-between" alignItems="center">
            {gtMd ? (
              <Tooltip
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.3}
                    cursor="help"
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_withdraw_fee,
                    })}
                  </DashText>
                }
                renderContent={
                  <SizableText size="$bodySm">
                    {intl.formatMessage({
                      id: ETranslations.perp_withdraw_fee_mgs,
                    })}
                  </SizableText>
                }
              />
            ) : (
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_withdraw_fee,
                })}
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.3}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_withdraw_fee,
                    })}
                  </DashText>
                }
                renderContent={() => (
                  <YStack px="$5" pb="$4">
                    <SizableText size="$bodyMd" color="$text">
                      {intl.formatMessage({
                        id: ETranslations.perp_withdraw_fee_mgs,
                      })}
                    </SizableText>
                  </YStack>
                )}
              />
            )}
            <SizableText color="$text" size="$bodyMd">
              ${WITHDRAW_FEE}
            </SizableText>
          </XStack>
        ) : null}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_you_will_get })}
          </SizableText>
          {selectedAction === 'withdraw' ? (
            <SizableText color="$text" size="$bodyMd">
              ${calculateFinalAmount(WITHDRAW_FEE)}{' '}
              {intl.formatMessage(
                {
                  id: ETranslations.perp_deposit_on,
                },
                {
                  chain: 'Arbitrum One',
                },
              )}
            </SizableText>
          ) : (
            <XStack gap="$1" alignItems="center" justifyContent="center">
              {perpDepositQuoteLoading ? (
                <Skeleton w={60} h={14} />
              ) : (
                <XStack gap="$1">
                  <SizableText color="$text" size="$bodyMd">
                    $
                    {numberFormat(depositToAmount.value, {
                      formatter: 'balance',
                    })}{' '}
                  </SizableText>
                  <SizableText color="$text" size="$bodyMd">
                    {intl.formatMessage(
                      {
                        id: ETranslations.perp_deposit_on,
                      },
                      {
                        chain: 'Hyperliquid',
                      },
                    )}
                  </SizableText>
                </XStack>
              )}
            </XStack>
          )}
        </XStack>
      </YStack>

      <Button
        variant="primary"
        size="medium"
        disabled={
          !isValidAmount ||
          isSubmitting ||
          balanceLoading ||
          (selectedAction === 'deposit' && perpDepositQuoteLoading) ||
          (selectedAction === 'deposit' &&
            !depositToAmount.canDeposit &&
            !checkRefreshQuote)
        }
        loading={isSubmitting}
        onPress={handleConfirm}
        mb={isMobile ? '$4' : undefined}
      >
        {buttonText}
      </Button>
    </YStack>
  );

  return (
    <>
      {content}
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID}>
          <InputAccessoryDoneButton leftContent={leftContent} />
        </InputAccessoryView>
      ) : null}
    </>
  );
}

function MobileDepositWithdrawModal() {
  const navigation = useNavigation();
  const [selectedAccount] = usePerpsActiveAccountAtom();

  const handleClose = useCallback(() => {
    setTimeout(
      () => {
        navigation.goBack();
      },
      platformEnv.isNative ? 350 : 0,
    );
  }, [navigation]);
  if (!selectedAccount) {
    return (
      <Page>
        <Page.Body>
          <YStack px="$4" flex={1} justifyContent="center" gap="$4">
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={200} />
            <Skeleton width="100%" height={60} />
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  if (!selectedAccount?.accountId || !selectedAccount?.accountAddress) {
    return (
      <Page>
        <Page.Body>
          <YStack px="$4" flex={1} justifyContent="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              You should select a valid account or create address first
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        title={appLocale.intl.formatMessage({
          id: ETranslations.perp_trade_account_overview,
        })}
      />
      <Page.Body>
        <PerpsProviderMirror>
          <YStack px="$4" flex={1}>
            <DepositWithdrawContent
              params={{ actionType: 'deposit' }}
              selectedAccount={selectedAccount}
              onClose={handleClose}
              isMobile
            />
          </YStack>
        </PerpsProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default MobileDepositWithdrawModal;

export async function showDepositWithdrawDialog(
  params: IDepositWithdrawParams,
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const selectedAccount = await perpsActiveAccountAtom.get();
  if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
    console.error('[DepositWithdrawModal] Missing required parameters');
    Toast.error({
      title: 'You should select a valid account or create address first',
    });
    return;
  }

  const dialogInTabRef = dialogInTab.show({
    renderContent: (
      <PerpsProviderMirror>
        <DepositWithdrawContent
          params={params}
          selectedAccount={selectedAccount}
          onClose={() => {
            void dialogInTabRef.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInTabRef.close();
    },
  });

  return dialogInTabRef;
}
