import { useCallback, useMemo, useState } from 'react';

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
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  perpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  USDC_TOKEN_INFO,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { InputAccessoryDoneButton } from '../inputs/TradingFormInput';

export type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';
const formatter: INumberFormatProps = {
  formatter: 'balance',
};

const DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID =
  'perp-deposit-withdraw-accessory-view';

interface IDepositWithdrawParams {
  withdrawable: string;
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
        <SizableText size="$bodySm">
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
  ]);

  const { normalizeTxConfirm } = useSignatureConfirm({
    accountId: selectedAccount.accountId || '',
    networkId: PERPS_NETWORK_ID,
  });

  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;

  const { result: usdcBalance, isLoading: balanceLoading } = usePromiseResult(
    async () => {
      if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
        return '0';
      }

      try {
        const tokenDetails =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: PERPS_NETWORK_ID,
            contractAddress: USDC_TOKEN_INFO.address,
            accountId: selectedAccount.accountId,
            accountAddress: selectedAccount.accountAddress,
          });
        return tokenDetails?.[0]?.balanceParsed || '0';
      } catch (error) {
        console.error(
          '[DepositWithdrawModal] Failed to fetch USDC balance:',
          error,
        );
        return '0';
      }
    },
    [selectedAccount.accountId, selectedAccount.accountAddress],
    {
      checkIsMounted: true,
      debounced: 1000,
    },
  );
  const availableBalance = useMemo(() => {
    if (selectedAction === 'withdraw') {
      return {
        balance: new BigNumber(params.withdrawable || '0').toFixed(),
        displayBalance: numberFormat(params.withdrawable || '0', formatter),
      };
    }
    return {
      balance: new BigNumber(usdcBalance || '0').toFixed(),
      displayBalance: numberFormat(usdcBalance || '0', formatter),
    };
  }, [selectedAction, params.withdrawable, usdcBalance]);
  const isValidAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance.balance || '0');

    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(balanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_DEPOSIT_AMOUNT))
      );
    }

    if (selectedAction === 'withdraw') {
      return (
        amountBN.lte(balanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_WITHDRAW_AMOUNT))
      );
    }

    return true;
  }, [amount, availableBalance, selectedAction, showMinAmountError]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    const amountBN = new BigNumber(amount || '0');
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
  }, [amount, selectedAction, showMinAmountError, intl]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setAmount(value);
        // Clear minimum amount error when user changes amount
        if (showMinAmountError) {
          setShowMinAmountError(false);
        }
      }
    },
    [showMinAmountError],
  );

  const handleAmountBlur = useCallback(() => {
    if (amount) {
      const amountBN = new BigNumber(amount);
      if (!amountBN.isNaN() && amountBN.gt(0)) {
        if (selectedAction === 'deposit' && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
          setShowMinAmountError(true);
        } else if (
          selectedAction === 'withdraw' &&
          amountBN.lt(MIN_WITHDRAW_AMOUNT)
        ) {
          setShowMinAmountError(true);
        }
      }
    }
  }, [selectedAction, amount]);

  const handleMaxPress = useCallback(() => {
    if (availableBalance) {
      setAmount(availableBalance.balance);
    }
  }, [availableBalance]);

  const handleTrade = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId: PERPS_NETWORK_ID,
        importFromToken: swapDefaultSetTokens[PERPS_NETWORK_ID].fromToken,
        importToToken: swapDefaultSetTokens[PERPS_NETWORK_ID].toToken,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.PERP,
      },
    });
  }, [navigation]);

  const validateAmountBeforeSubmit = useCallback(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance.balance || '0');

    if (amountBN.isNaN() || amountBN.lte(0)) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.dexmarket_enter_amount }),
      });
      return false;
    }

    if (amountBN.gt(balanceBN)) {
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
  }, [amount, availableBalance, intl, selectedAction, showMinAmountError]);

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
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance.balance || '0');
    return amountBN.gt(balanceBN) && amountBN.gt(0);
  }, [amount, availableBalance]);
  const buttonText = useMemo(() => {
    if (isInsufficientBalance)
      return intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    return selectedAction === 'deposit'
      ? intl.formatMessage({ id: ETranslations.perp_trade_deposit })
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [isInsufficientBalance, selectedAction, intl]);

  const content = (
    <YStack
      gap="$4"
      p="$1"
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
          value="Arbitrum One"
          onChangeText={() => {}}
          keyboardType="default"
          readonly
          borderWidth={0}
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
          borderColor={errorMessage ? '$red7' : '$borderSubdued'}
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
          />
          <XStack alignItems="center">
            <SizableText size="$bodyMd">USDC</SizableText>
          </XStack>
        </XStack>

        {errorMessage ? (
          <SizableText size="$bodySm" color="$red10">
            {errorMessage}
          </SizableText>
        ) : null}
        {isInsufficientBalance ? (
          <XStack gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.earn_not_enough_token },
                { token: 'USDC' },
              )}
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
                  id: ETranslations.perp_trade_withdrawable,
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
                {(availableBalance.displayBalance || '0.00').toString()}
              </DashText>
            )}
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
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_you_will_get })}
          </SizableText>
          <SizableText color="$text" size="$bodyMd">
            ${amount || '0'} on{' '}
            {selectedAction === 'deposit' ? 'Hyperliquid' : 'Arbitrum One'}
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
          <InputAccessoryDoneButton />
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
