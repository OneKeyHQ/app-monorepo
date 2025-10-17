import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  Icon,
  Input,
  ListView,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  Skeleton,
  Toast,
  Tooltip,
  XStack,
  YStack,
  getFontSize,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IPerpsActiveAccountAtom,
  IPerpsDepositToken,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  perpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsDepositNetworksAtom,
  usePerpsDepositTokensAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  PERPS_ETH_NETWORK_ID,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
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
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

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
}

function DepositWithdrawContent({
  params,
  selectedAccount,
  onClose,
}: IDepositWithdrawContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const accountValue = accountSummary?.accountValue ?? '';
  const withdrawable = accountSummary?.withdrawable ?? '';
  const accountValueInfoTrigger = useMemo(
    () => (
      <XStack
        alignItems="center"
        gap="$1"
        cursor={!platformEnv.isNative ? 'pointer' : undefined}
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_account_panel_account_value,
          })}
        </SizableText>
        <Icon name="InfoCircleSolid" size="$4" color="$iconSubdued" />
      </XStack>
    ),
    [intl],
  );
  const accountValuePopoverContent = useMemo(
    () => (
      <YStack flex={1} px="$5" pb="$5">
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.perp_account_panel_account_value_tooltip,
          })}
        </SizableText>
      </YStack>
    ),
    [intl],
  );
  const useTooltipForAccountValue = !platformEnv.isNative && gtMd;
  const accountValueInfoNode = useMemo(() => {
    if (useTooltipForAccountValue) {
      return (
        <Tooltip
          placement="top"
          renderContent={intl.formatMessage({
            id: ETranslations.perp_account_panel_account_value_tooltip,
          })}
          renderTrigger={accountValueInfoTrigger}
        />
      );
    }
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.perp_account_panel_account_value,
        })}
        renderTrigger={accountValueInfoTrigger}
        renderContent={accountValuePopoverContent}
      />
    );
  }, [
    intl,
    accountValueInfoTrigger,
    accountValuePopoverContent,
    useTooltipForAccountValue,
  ]);
  const [selectedAction, setSelectedAction] =
    useState<IPerpsDepositWithdrawActionType>(params.actionType);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinAmountError, setShowMinAmountError] = useState(false);
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [
    { currentPerpsDepositSelectedNetwork, networks },
    setPerpsDepositNetworksAtom,
  ] = usePerpsDepositNetworksAtom();
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
        networkId: currentPerpsDepositSelectedNetwork?.networkId || '',
      });
    } else if (selectedAccount.indexedAccountId) {
      indexedAccount = await serviceAccount.getIndexedAccount({
        id: selectedAccount.indexedAccountId,
      });
    }

    console.log('accountResult--', {
      wallet,
      account,
      indexedAccount,
      isOtherAccount,
    });

    return {
      wallet,
      account,
      indexedAccount,
      isOtherAccount,
    };
  }, [
    selectedAccount.indexedAccountId,
    selectedAccount.accountId,
    serviceAccount,
    currentPerpsDepositSelectedNetwork?.networkId,
  ]);

  const { normalizeTxConfirm } = useSignatureConfirm({
    accountId: selectedAccount.accountId || '',
    networkId: currentPerpsDepositSelectedNetwork?.networkId || '',
  });

  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;

  const { result, isLoading: balanceLoading } = usePromiseResult(
    async () => {
      if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
        return [];
      }

      try {
        const tokensList =
          tokens.get(currentPerpsDepositSelectedNetwork?.networkId || '') || [];
        const tokenDetails =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: currentPerpsDepositSelectedNetwork?.networkId || '',
            contractAddress:
              tokensList?.map((token) => token.contractAddress).join(',') || '',
            accountId: selectedAccount.accountId,
            accountAddress: selectedAccount.accountAddress,
          });
        if (tokenDetails) {
          const depositTokensWithPriceRes = tokensList.map((token) => ({
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
          }));
          setDepositTokensWithPrice(depositTokensWithPriceRes);
          return depositTokensWithPriceRes;
        }
      } catch (error) {
        console.error(
          '[DepositWithdrawModal] Failed to fetch USDC balance:',
          error,
        );
        return [];
      }
    },
    [
      selectedAccount.accountId,
      selectedAccount.accountAddress,
      currentPerpsDepositSelectedNetwork?.networkId,
      tokens,
    ],
    {
      watchLoading: true,
      checkIsMounted: true,
      debounced: 1000,
    },
  );

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

  const isValidAmount = useMemo(() => {
    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(availableBalanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_DEPOSIT_AMOUNT))
      );
    }

    if (selectedAction === 'withdraw') {
      return (
        amountBN.lte(availableBalanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_WITHDRAW_AMOUNT))
      );
    }

    return true;
  }, [amountBN, availableBalanceBN, selectedAction, showMinAmountError]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinAmountError && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
        return intl.formatMessage(
          { id: ETranslations.perp_mini_deposit },
          { num: MIN_DEPOSIT_AMOUNT, token: 'USDC' },
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
  }, [amount, amountBN, selectedAction, showMinAmountError, intl]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
        setAmount(value);
        // Clear minimum amount error when user changes amount
        if (showMinAmountError) {
          setShowMinAmountError(false);
        }
      }
    },
    [showMinAmountError],
  );
  const calculateFinalAmount = (withdrawFee: number): string => {
    const finalResult = new BigNumber(amount || '0').minus(
      selectedAction === 'withdraw' ? withdrawFee : 0,
    );

    return finalResult.isPositive() ? finalResult.toFixed() : '0';
  };
  const handleAmountBlur = useCallback(() => {
    if (amount && !amountBN.isNaN() && amountBN.gt(0)) {
      if (selectedAction === 'deposit' && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
        setShowMinAmountError(true);
      } else if (
        selectedAction === 'withdraw' &&
        amountBN.lt(MIN_WITHDRAW_AMOUNT)
      ) {
        setShowMinAmountError(true);
      }
    }
  }, [selectedAction, amount, amountBN]);

  const handleMaxPress = useCallback(() => {
    if (availableBalance) {
      setAmount(availableBalance.displayBalance);
    }
  }, [availableBalance]);

  const handleTrade = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId: PERPS_ETH_NETWORK_ID,
        importFromToken: swapDefaultSetTokens[PERPS_ETH_NETWORK_ID].fromToken,
        importToToken: swapDefaultSetTokens[PERPS_NETWORK_ID].toToken,
        swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
        swapSource: ESwapSource.PERP,
      },
    });
  }, [navigation]);

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

    if (selectedAction === 'deposit' && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
      setShowMinAmountError(true);
      const message = intl.formatMessage(
        { id: ETranslations.perp_mini_deposit },
        { num: MIN_DEPOSIT_AMOUNT, token: 'USDC' },
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
  }, [amountBN, availableBalanceBN, intl, selectedAction, showMinAmountError]);
  const leftContent = useMemo(() => {
    return selectedAction === 'deposit' ? (
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.perp_size_least },
          { amount: `${MIN_DEPOSIT_AMOUNT} USDC` },
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
    selectedAction,
    amount,
    normalizeTxConfirm,
    onClose,
    withdraw,
    validateAmountBeforeSubmit,
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
    return selectedAction === 'deposit'
      ? intl.formatMessage({ id: ETranslations.perp_trade_deposit })
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [isInsufficientBalance, selectedAction, intl]);

  useEffect(() => {
    if (networks.length > 0 && !currentPerpsDepositSelectedNetwork) {
      setPerpsDepositNetworksAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedNetwork: networks[0],
      }));
    }
  }, [
    networks,
    currentPerpsDepositSelectedNetwork,
    setPerpsDepositNetworksAtom,
  ]);

  useEffect(() => {
    if (
      currentPerpsDepositSelectedNetwork?.networkId &&
      tokens.get(currentPerpsDepositSelectedNetwork?.networkId)?.length &&
      !currentPerpsDepositSelectedToken
    ) {
      setPerpsDepositTokensAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedToken: tokens.get(
          currentPerpsDepositSelectedNetwork?.networkId,
        )?.[0],
      }));
    }
    if (
      currentPerpsDepositSelectedNetwork?.networkId &&
      currentPerpsDepositSelectedToken?.networkId &&
      currentPerpsDepositSelectedToken?.networkId !==
        currentPerpsDepositSelectedNetwork?.networkId
    ) {
      const newTokens = tokens.get(
        currentPerpsDepositSelectedNetwork?.networkId,
      );
      setPerpsDepositTokensAtom((prev) => ({
        ...prev,
        currentPerpsDepositSelectedToken: newTokens?.[0],
      }));
    }
  }, [
    tokens,
    currentPerpsDepositSelectedToken,
    setPerpsDepositTokensAtom,
    networks,
    currentPerpsDepositSelectedNetwork?.networkId,
  ]);

  const depositNetworkSelectComponent = useMemo(() => {
    return (
      <Select
        items={networks.map((network) => ({
          label: network.name,
          value: network.networkId,
          leading: <NetworkAvatar networkId={network.networkId} size="$5" />,
        }))}
        value={currentPerpsDepositSelectedNetwork?.networkId}
        onChange={(value) => {
          setPerpsDepositNetworksAtom((prev) => ({
            ...prev,
            currentPerpsDepositSelectedNetwork: networks.find(
              (network) => network.networkId === value,
            ),
          }));
        }}
        title={intl.formatMessage({
          id: ETranslations.perp_deposit_chain,
        })}
        renderTrigger={({ value, label }) => {
          return (
            <XStack alignItems="center" gap="$1" cursor="pointer">
              <SizableText size="$bodyMd" color="$textSubdued">
                {label}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                size="$5"
              />
            </XStack>
          );
        }}
      />
    );
  }, [
    currentPerpsDepositSelectedNetwork?.networkId,
    intl,
    networks,
    setPerpsDepositNetworksAtom,
  ]);
  const renderTokenItem = useCallback<ListRenderItem<IPerpsDepositToken>>(
    ({ item }) => {
      const balanceFormatted = numberFormat(item.balanceParsed ?? '0', {
        formatter: 'balance',
      });
      const fiatValueFormatted = numberFormat(item.fiatValue ?? '0', {
        formatter: 'value',
        formatterOptions: { currency: settingsPersistAtom.currencyInfo.symbol },
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
    [settingsPersistAtom.currencyInfo.symbol, setPerpsDepositTokensAtom],
  );
  const depositTokenSelectComponent = useMemo(() => {
    if (!currentPerpsDepositSelectedNetwork?.networkId) return undefined;
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
        renderContent={() => (
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
        )}
      />
    );
  }, [
    currentPerpsDepositSelectedNetwork?.networkId,
    intl,
    currentPerpsDepositSelectedToken?.symbol,
    depositTokensWithPrice,
    renderTokenItem,
  ]);
  const {
    perpDepositQuote,
    perpDepositQuoteLoading,
    perpDepositActionLoading,
    buildPerpDepositTx,
    multipleStepText,
    shouldApprove,
  } = usePerpDeposit(
    amount,
    selectedAccount.accountId ?? '',
    selectedAction,
    currentPerpsDepositSelectedToken,
  );
  const content = (
    <YStack
      gap="$4"
      px="$1"
      pt="$1"
      style={{
        marginTop: -22,
      }}
    >
      <YStack gap="$2.5">
        <XStack alignItems="center" gap="$2" pb="$3">
          <AccountAvatar
            size="small"
            account={
              accountResult?.isOtherAccount ? accountResult?.account : undefined
            }
            indexedAccount={
              accountResult?.isOtherAccount
                ? undefined
                : accountResult?.indexedAccount
            }
            wallet={accountResult?.wallet}
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
        <YStack gap="$1" alignItems="flex-start">
          {accountValueInfoNode}
          <PerpsAccountNumberValue
            value={accountValue}
            skeletonWidth={120}
            textSize="$heading4xl"
          />
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
      <XStack
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$3"
        px="$3"
        bg="$bgSubdued"
        alignItems="center"
        gap="$3"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {selectedAction === 'withdraw'
            ? intl.formatMessage({ id: ETranslations.perp_withdraw_chain })
            : intl.formatMessage({ id: ETranslations.perp_deposit_chain })}
        </SizableText>
        <Input
          flex={1}
          onChangeText={() => {}}
          keyboardType="default"
          readonly
          borderWidth={0}
          addOns={[
            {
              renderContent: depositNetworkSelectComponent,
            },
          ]}
          addOnsContainerProps={{
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
          size="medium"
          fontSize={getFontSize('$bodyMd')}
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
          alignContent="flex-end"
          textAlign="right"
        />
      </XStack>

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
        {isInsufficientBalance && selectedAction === 'deposit' ? (
          <XStack gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.earn_not_enough_token },
                { token: 'USDC' },
              )}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_deposit_try_to,
              })}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$green11"
              onPress={handleTrade}
              cursor="pointer"
            >
              {intl.formatMessage({ id: ETranslations.global_trade })}
            </SizableText>
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
                {`${availableBalance.displayBalance || '0.00'} USDC`}
              </DashText>
            )}
            {selectedAction === 'withdraw' ? null : (
              <SizableText
                size="$bodyMd"
                color="$green11"
                cursor="pointer"
                onPress={handleTrade}
              >
                {intl.formatMessage({
                  id: ETranslations.global_trade,
                })}
              </SizableText>
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
          <SizableText color="$text" size="$bodyMd">
            ${calculateFinalAmount(WITHDRAW_FEE)}{' '}
            {intl.formatMessage(
              {
                id: ETranslations.perp_deposit_on,
              },
              {
                chain:
                  selectedAction === 'deposit' ? 'Hyperliquid' : 'Arbitrum One',
              },
            )}
          </SizableText>
        </XStack>
      </YStack>

      <Button
        variant="primary"
        size="medium"
        disabled={!isValidAmount || isSubmitting || balanceLoading}
        loading={isSubmitting}
        onPress={handleConfirm}
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

export async function showDepositWithdrawModal(
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
