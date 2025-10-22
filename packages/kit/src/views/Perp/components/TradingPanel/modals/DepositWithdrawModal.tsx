import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type {
  ISegmentControlProps,
  useInTabDialog,
} from '@onekeyhq/components';
import {
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
}: {
  depositTokensWithPrice: IPerpsDepositToken[];
  symbol: string;
}) {
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
      return (
        <ListItem
          justifyContent="space-between"
          py="$2"
          onPress={() => {
            setPerpsDepositTokensAtom((prev) => ({
              ...prev,
              currentPerpsDepositSelectedToken: item,
            }));
            void closePopover?.();
          }}
        >
          <XStack>
            <Token
              tokenImageUri={item.logoURI}
              networkImageUri={item.networkLogoURI}
              showNetworkIcon
            />
            <YStack>
              <SizableText size="$bodySm">{item.symbol}</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {item.name}
              </SizableText>
            </YStack>
          </XStack>
          <YStack alignItems="flex-end">
            <SizableText size="$bodySm">{balanceFormatted}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {fiatValueFormatted}
            </SizableText>
          </YStack>
        </ListItem>
      );
    },
    [symbol, setPerpsDepositTokensAtom, closePopover],
  );
  return (
    <YStack>
      <ListView
        contentContainerStyle={{
          borderRadius: 12,
          py: '$2',
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
      >
        <SizableText size="$bodySm" color="$textSubdued">
          if you wish to trade other tokens, switch to
        </SizableText>
        <SizableText size="$bodySm">Trade</SizableText>
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
    const pnlColor = pnlBn.lt(0) ? '$red11' : '$green11';
    const pnlPlusOrMinus = pnlBn.lt(0) ? '-' : '+';
    return { pnlFormatted, pnlColor, pnlPlusOrMinus };
  }, [unrealizedPnl]);
  const [
    { tokens, currentPerpsDepositSelectedToken },
    setPerpsDepositTokensAtom,
  ] = usePerpsDepositTokensAtom();

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

  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;

  const { result, isLoading: balanceLoading } = usePromiseResult(
    async () => {
      if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
        return [];
      }

      try {
        const tokensList = Array.from(tokens.values()).flat() || [];
        const networkIds = tokens.keys();
        const tokenDetailsLists = await Promise.all(
          networkIds.map(async (networkId) => {
            const accountAddressInfo =
              await backgroundApiProxy.serviceAccount.getNetworkAccount({
                indexedAccountId: selectedAccount.indexedAccountId ?? '',
                networkId,
                deriveType: selectedAccount.deriveType ?? 'default',
                accountId: undefined,
              });
            const tokenDetails =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                networkId,
                contractAddress:
                  tokens
                    ?.get(networkId)
                    ?.map((token) => token.contractAddress)
                    .join(',') || '',
                accountAddress: accountAddressInfo.addressDetail.address,
                accountId: accountAddressInfo.id ?? '',
              });
            return tokenDetails;
          }),
        );
        const tokenDetails = tokenDetailsLists?.flat().filter(Boolean) ?? [];
        if (tokenDetails) {
          const depositTokensWithPriceRes = tokensList
            .map((token) => ({
              ...token,
              balanceParsed: tokenDetails.find(
                (t) => t.contractAddress === token.contractAddress,
              )?.balanceParsed,
              price: tokenDetails.find(
                (t) => t.contractAddress === token.contractAddress,
              )?.price,
              fiatValue: tokenDetails.find(
                (t) => t.contractAddress === token.contractAddress,
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
        return [];
      }
    },
    [
      selectedAccount.accountId,
      selectedAccount.accountAddress,
      selectedAccount.indexedAccountId,
      selectedAccount.deriveType,
      tokens,
    ],
    {
      watchLoading: true,
      checkIsMounted: true,
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

    return {
      balance: rawBalance,
      displayBalance: numberFormat(rawBalance, { formatter: 'balance' }),
    };
  }, [
    selectedAction,
    withdrawable,
    currentPerpsDepositSelectedToken?.balanceParsed,
  ]);

  const amountBN = useMemo(() => new BigNumber(amount || '0'), [amount]);

  const availableBalanceBN = useMemo(
    () => new BigNumber(availableBalance.balance || '0'),
    [availableBalance.balance],
  );

  const checkFromTokenFiatValue = useMemo(() => {
    const fromTokenPrice = currentPerpsDepositSelectedToken?.price;
    const fromTokenFiatValue = new BigNumber(
      fromTokenPrice || '0',
    ).multipliedBy(amountBN);
    return fromTokenFiatValue.isPositive() && !fromTokenFiatValue?.isNaN()
      ? fromTokenFiatValue.gte(MIN_DEPOSIT_AMOUNT)
      : false;
  }, [amountBN, currentPerpsDepositSelectedToken?.price]);

  const isValidAmount = useMemo(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(availableBalanceBN) &&
        (!showMinAmountError || checkFromTokenFiatValue)
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
    checkFromTokenFiatValue,
  ]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinAmountError && !checkFromTokenFiatValue) {
        return intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `$${MIN_DEPOSIT_AMOUNT}` },
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
    checkFromTokenFiatValue,
    intl,
  ]);

  const {
    perpDepositQuote,
    perpDepositQuoteLoading,
    buildPerpDepositTx,
    multipleStepText,
    isArbitrumUsdcToken,
    // shouldApprove,
  } = usePerpDeposit(
    amount,
    selectedAccount.accountId ?? '',
    selectedAction,
    currentPerpsDepositSelectedToken,
  );

  const handleAmountChange = useCallback(
    (value: string) => {
      if (
        validateAmountInput(value, currentPerpsDepositSelectedToken?.decimals)
      ) {
        setAmount(value);
        // Clear minimum amount error when user changes amount
        if (showMinAmountError) {
          setShowMinAmountError(false);
        }
      }
    },
    [currentPerpsDepositSelectedToken?.decimals, showMinAmountError],
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
      if (selectedAction === 'deposit' && !checkFromTokenFiatValue) {
        setShowMinAmountError(true);
      } else if (
        selectedAction === 'withdraw' &&
        amountBN.lt(MIN_WITHDRAW_AMOUNT)
      ) {
        setShowMinAmountError(true);
      }
    }
  }, [amount, amountBN, selectedAction, checkFromTokenFiatValue]);

  const handleMaxPress = useCallback(() => {
    if (availableBalance) {
      setAmount(availableBalance.displayBalance);
    }
  }, [availableBalance]);

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

    if (selectedAction === 'deposit' && !checkFromTokenFiatValue) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_size_least },
        { amount: `$${MIN_DEPOSIT_AMOUNT}` },
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
    checkFromTokenFiatValue,
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
      setIsSubmitting(true);

      if (selectedAction === 'deposit') {
        if (isArbitrumUsdcToken) {
          await normalizeTxConfirm({
            onSuccess: () => {
              // TODO wait tx confirmed then check account status
              void backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
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
        }
        onClose?.();
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
    selectedAction,
    isArbitrumUsdcToken,
    onClose,
    normalizeTxConfirm,
    amount,
    buildPerpDepositTx,
    withdraw,
  ]);

  const nativeInputProps = platformEnv.isNativeIOS
    ? { inputAccessoryViewID: DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID }
    : {};

  const isInsufficientBalance = useMemo(() => {
    return amountBN.gt(availableBalanceBN) && amountBN.gt(0);
  }, [amountBN, availableBalanceBN]);
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
    return selectedAction === 'deposit'
      ? depositActionText
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [isInsufficientBalance, intl, multipleStepText, selectedAction]);

  useEffect(() => {
    if (!currentPerpsDepositSelectedToken) {
      setPerpsDepositTokensAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedToken: depositTokensWithPrice?.[0],
      }));
    }
  }, [
    depositTokensWithPrice,
    currentPerpsDepositSelectedToken,
    setPerpsDepositTokensAtom,
  ]);

  const depositTokenSelectComponent = useMemo(() => {
    if (balanceLoading) return <Skeleton w={50} h={14} />;
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        })}
        placement="bottom-end"
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
          />
        }
      />
    );
  }, [
    balanceLoading,
    intl,
    currentPerpsDepositSelectedToken?.symbol,
    settingsPersistAtom.currencyInfo?.symbol,
    depositTokensWithPrice,
  ]);

  const depositToAmount = useMemo(() => {
    let depositToAmountRes = '0';
    if (isArbitrumUsdcToken) {
      depositToAmountRes = amountBN
        .multipliedBy(currentPerpsDepositSelectedToken?.price ?? 0)
        .toFixed();
    } else {
      depositToAmountRes = perpDepositQuote?.result?.toAmount ?? '0';
    }
    const depositToAmountBN = new BigNumber(depositToAmountRes);
    return {
      value: depositToAmountRes,
      canDeposit: depositToAmountBN.gt(0) && !depositToAmountBN.isNaN(),
    };
  }, [
    isArbitrumUsdcToken,
    amountBN,
    currentPerpsDepositSelectedToken,
    perpDepositQuote?.result?.toAmount,
  ]);

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
        onChange={setSelectedAction as ISegmentControlProps['onChange']}
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
            maxLength={12}
            addOns={[
              {
                renderContent: depositTokenSelectComponent,
              },
            ]}
            addOnsContainerProps={{
              justifyContent: 'flex-end',
              alignItems: 'center',
              ml: '$2',
            }}
          />
        </XStack>

        {errorMessage ? (
          <SizableText size="$bodySm" color="$red10">
            {errorMessage}
          </SizableText>
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
            {balanceLoading ? (
              <Skeleton w={80} h={14} />
            ) : (
              <DashText
                dashColor="$textDisabled"
                dashThickness={0.2}
                dashGap={3}
                cursor="pointer"
                onPress={handleMaxPress}
                size="$bodyMd"
              >
                {`${availableBalance.displayBalance || '0.00'} ${
                  currentPerpsDepositSelectedToken?.symbol ?? '-'
                }`}
              </DashText>
            )}
          </XStack>
        </XStack>
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
            <XStack gap="$1" alignItems="center">
              {perpDepositQuoteLoading ? (
                <Skeleton w={60} h={14} />
              ) : (
                <SizableText color="$text" size="$bodyMd">
                  $
                  {numberFormat(depositToAmount.value, {
                    formatter: 'balance',
                  })}{' '}
                </SizableText>
              )}
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
      </YStack>

      <Button
        variant="primary"
        size="medium"
        disabled={
          !isValidAmount ||
          isSubmitting ||
          balanceLoading ||
          (selectedAction === 'deposit' && perpDepositQuoteLoading) ||
          (selectedAction === 'deposit' && !depositToAmount.canDeposit)
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
    navigation.goBack();
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
