import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import {
  InputAccessoryView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  Input,
  ListView,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  Skeleton,
  Toast,
  XStack,
  YStack,
  getFontSize,
  useIsKeyboardShown,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  perpsActiveAccountAtom,
  usePerpsDepositNetworksAtom,
  usePerpsDepositTokensAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpsActiveAccountAtom,
  IPerpsDepositToken,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  USDC_TOKEN_INFO,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';

import type { ListRenderItem } from 'react-native';

export type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

const DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID =
  'perp-deposit-withdraw-accessory-view';

function DepositWithdrawKeyboardAccessory({ onDone }: { onDone: () => void }) {
  const intl = useIntl();
  const isKeyboardShown = useIsKeyboardShown();

  if (!platformEnv.isNative) return null;

  const shouldShow = platformEnv.isNativeIOS || isKeyboardShown;

  if (!shouldShow) return null;

  return (
    <XStack
      px="$4"
      py="$2"
      w="100%"
      justifyContent="flex-end"
      bg="$bgSubdued"
      borderTopWidth="$px"
      borderTopColor="$borderSubdued"
    >
      <Button variant="tertiary" size="small" onPress={onDone}>
        {intl.formatMessage({ id: ETranslations.global_done })}
      </Button>
    </XStack>
  );
}

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
  const [selectedAction, setSelectedAction] =
    useState<IPerpsDepositWithdrawActionType>(params.actionType);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinAmountError, setShowMinAmountError] = useState(false);
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
            networkImageURI: findToken?.networkImageURI,
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
    if (selectedAction === 'withdraw') {
      return new BigNumber(params.withdrawable || '0').toFixed(2);
    }
    return new BigNumber(currentPerpsDepositSelectedToken?.balanceParsed || '0')
      .decimalPlaces(2, BigNumber.ROUND_DOWN)
      .toFixed();
  }, [
    selectedAction,
    params.withdrawable,
    currentPerpsDepositSelectedToken?.balanceParsed,
  ]);
  const isValidAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');

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
      setAmount(availableBalance);
    }
  }, [availableBalance]);

  const validateAmountBeforeSubmit = useCallback(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');

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

        Toast.success({
          title: 'Deposit Initiated',
          message: `${amount} USDC deposit transaction has been submitted`,
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

  const handleKeyboardDone = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const nativeInputProps = platformEnv.isNative
    ? {
        inputAccessoryViewID: DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID,
        returnKeyType: 'done' as const,
        blurOnSubmit: true,
        onSubmitEditing: () => {
          handleKeyboardDone();
        },
      }
    : {};

  const isInsufficientBalance = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');
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
      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          {item.name}
        </SizableText>
      );
    },
    [],
  );
  const depositTokenSelectComponent = useMemo(() => {
    if (!currentPerpsDepositSelectedNetwork?.networkId) return undefined;
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        })}
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
          <ListView
            data={depositTokensWithPrice}
            renderItem={renderTokenItem}
            ListFooterComponent={
              <XStack h="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  if you wish to trade other tokens, switch to
                </SizableText>
                <SizableText size="$bodySm">Trade</SizableText>
              </XStack>
            }
          />
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

  const content = (
    <YStack
      gap="$4"
      p="$1"
      style={{
        marginTop: -22,
      }}
    >
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
                  id: ETranslations.perp_trade_withdrawable,
                })
              : intl.formatMessage({
                  id: ETranslations.perp_available_balance,
                })}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            {balanceLoading ? (
              <Skeleton w={80} h={14} />
            ) : (
              <SizableText
                cursor="pointer"
                onPress={handleMaxPress}
                color="$text"
                size="$bodyMd"
              >
                {availableBalance || '0.00'}{' '}
                <SizableText size="$bodyMd" color="$green11">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_custom_filters_max,
                  })}
                </SizableText>
              </SizableText>
            )}
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
      {platformEnv.isNative && !platformEnv.isNativeIOS ? (
        <DepositWithdrawKeyboardAccessory onDone={handleKeyboardDone} />
      ) : null}
    </YStack>
  );

  const wrappedContent = platformEnv.isNative ? (
    <TouchableWithoutFeedback onPress={handleKeyboardDone} accessible={false}>
      {content}
    </TouchableWithoutFeedback>
  ) : (
    content
  );

  return (
    <>
      {wrappedContent}
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={DEPOSIT_WITHDRAW_INPUT_ACCESSORY_VIEW_ID}>
          <DepositWithdrawKeyboardAccessory onDone={handleKeyboardDone} />
        </InputAccessoryView>
      ) : null}
    </>
  );
}

export async function showDepositWithdrawModal(params: IDepositWithdrawParams) {
  const selectedAccount = await perpsActiveAccountAtom.get();
  if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
    console.error('[DepositWithdrawModal] Missing required parameters');
    Toast.error({
      title: 'You should select a valid account or create address first',
    });
    return;
  }

  const dialogInstance = Dialog.show({
    renderContent: (
      <PerpsProviderMirror>
        <DepositWithdrawContent
          params={params}
          selectedAccount={selectedAccount}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
