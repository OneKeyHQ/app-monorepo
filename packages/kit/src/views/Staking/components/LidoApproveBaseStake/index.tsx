import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Alert,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useTokenAllowance } from '../../hooks/useUtilsHooks';
import { LIDO_LOGO_URI } from '../../utils/const';

type ILidoApproveBaseStakeProps = {
  price: string;
  balance: string;
  token: IToken;
  receivingTokenSymbol: string;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token: IToken;
  };
  currentAllowance?: string;
  apr?: number;
  minAmount?: number;
  onConfirm?: (amount: string) => Promise<void>;
};

export const LidoApproveBaseStake = ({
  price,
  balance,
  token,
  receivingTokenSymbol,
  apr = 4,
  minAmount = 0,
  currentAllowance = '0',
  onConfirm,
  approveTarget,
}: PropsWithChildren<ILidoApproveBaseStakeProps>) => {
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [approving, setApproving] = useState<boolean>(false);
  const {
    allowance,
    loading: loadingAllowance,
    refreshAllowance,
  } = useTokenAllowance({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token.address,
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance,
  });
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const onChangeAmountValue = useCallback((value: string) => {
    const valueBN = new BigNumber(value);
    if (valueBN.isNaN()) {
      if (value === '') {
        setAmountValue('');
      }
      return;
    }
    setAmountValue(value);
  }, []);

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
  }, [amountValue, price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gte(balance),
    [amountValue, balance],
  );

  const isLessThanMinAmount = useMemo<boolean>(() => {
    const minAmountBn = new BigNumber(minAmount);
    const amountValueBn = new BigNumber(amountValue);
    if (minAmountBn.isGreaterThan(0) && amountValueBn.isGreaterThan(0)) {
      return amountValueBn.isLessThan(minAmountBn);
    }
    return false;
  }, [minAmount, amountValue]);

  const isDisable = useMemo(
    () =>
      BigNumber(amountValue).isNaN() ||
      isInsufficientBalance ||
      isLessThanMinAmount,
    [amountValue, isInsufficientBalance, isLessThanMinAmount],
  );

  const isApprove = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);
    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [amountValue, allowance]);

  const onConfirmText = useMemo(() => {
    if (isInsufficientBalance) {
      return 'Insufficient balance';
    }
    if (isApprove) {
      return `Approve ${amountValue} ${token.symbol.toUpperCase()}`;
    }
    return 'Stake';
  }, [isInsufficientBalance, isApprove, token, amountValue]);

  const onApprove = useCallback(async () => {
    setApproving(true);
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    await navigationToSendConfirm({
      approveInfo: {
        owner: account.address,
        spender: approveTarget.spenderAddress,
        amount: amountValue,
        tokenInfo: approveTarget.token,
      },
      onSuccess(data) {
        console.log('data', data);
        refreshAllowance(data[0].decodedTx.txid);
        setApproving(false);
      },
      onFail() {
        setApproving(false);
      },
    });
  }, [amountValue, approveTarget, navigationToSendConfirm, refreshAllowance]);

  const onSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm?.(amountValue);
    } finally {
      setLoading(false);
    }
  }, [onConfirm, amountValue]);

  const estAnnualRewards = useMemo(() => {
    const bn = BigNumber(amountValue);
    if (!amountValue || bn.isNaN()) {
      return null;
    }
    const amountBN = BigNumber(amountValue).multipliedBy(apr).dividedBy(100);
    return (
      <XStack space="$1">
        <SizableText>
          {amountBN.toFixed()} {token.symbol.toUpperCase()} ({' '}
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: symbol }}
          >
            {amountBN.multipliedBy(price).toFixed()}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    );
  }, [amountValue, apr, price, symbol, token.symbol]);

  return (
    <YStack>
      <Stack mx="$2" px="$3" space="$5">
        <AmountInput
          hasError={isInsufficientBalance || isLessThanMinAmount}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: token.logoURI,
            selectedTokenSymbol: token.symbol.toUpperCase(),
          }}
          balanceProps={{
            value: balance,
          }}
          inputProps={{
            placeholder: '0',
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
        />
        {isLessThanMinAmount ? (
          <Alert
            icon="InfoCircleOutline"
            type="critical"
            title={`The minimum amount for this staking is ${minAmount} ETH.`}
          />
        ) : null}
      </Stack>
      <Stack>
        <YStack>
          {estAnnualRewards ? (
            <ListItem
              title="Est. annual rewards"
              titleProps={{ color: '$textSubdued' }}
            >
              {estAnnualRewards}
            </ListItem>
          ) : null}
          {amountValue ? (
            <ListItem
              title="Est. receive"
              titleProps={{ color: '$textSubdued' }}
            >
              <ListItem.Text
                primary={`${amountValue} ${receivingTokenSymbol.toUpperCase()}`}
              />
            </ListItem>
          ) : null}
          <ListItem title="APR" titleProps={{ color: '$textSubdued' }}>
            <ListItem.Text
              primary={`${apr}%`}
              primaryTextProps={{ color: '$textSuccess' }}
            />
          </ListItem>
          <ListItem title="Protocol" titleProps={{ color: '$textSubdued' }}>
            <XStack space="$2" alignItems="center">
              <Token size="sm" tokenImageUri={LIDO_LOGO_URI} />
              <SizableText size="$bodyMdMedium">Lido</SizableText>
            </XStack>
          </ListItem>
          <ListItem
            title="Stake Release Period"
            titleProps={{ color: '$textSubdued' }}
          >
            <ListItem.Text primary="< 4 Days" />
          </ListItem>
        </YStack>
      </Stack>
      <Page.Footer
        onConfirmText={onConfirmText}
        confirmButtonProps={{
          onPress: isApprove ? onApprove : onSubmit,
          loading: loading || loadingAllowance || approving,
          disabled: isDisable,
        }}
      />
    </YStack>
  );
};
