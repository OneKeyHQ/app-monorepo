import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil, map } from 'lodash';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function AccountValue(accountValue: {
  walletId: string;
  accountId: string;
  currency: string;
  value: Record<string, string> | string;
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const isActiveAccount =
    activeAccountValue?.accountId === accountValue?.accountId;

  const {
    linkedAccountId,
    linkedNetworkId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    walletId,
    indexedAccountId,
  } = accountValue;

  const { currency, value } = useMemo(() => {
    if (activeAccountValue && isActiveAccount) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue, isActiveAccount]);

  const { enabledNetworksCompatibleWithWalletId } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId,
      networkId: linkedNetworkId,
      indexedAccountId,
    });

  const accountValueString = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }

    if (linkedNetworkId && mergeDeriveAssetsEnabled && !isSingleAddress) {
      let mergedValue = new BigNumber(0);
      let accountValueExist = false;

      const matchedAccountValues = map(value, (v, k) => {
        const keyArray = k.split('_');
        const networkId = keyArray[keyArray.length - 1];
        if (networkId === linkedNetworkId) {
          return v;
        }
      }).filter((v) => !isNil(v));

      if (matchedAccountValues.length > 0) {
        accountValueExist = true;
        mergedValue = matchedAccountValues.reduce(
          (acc: BigNumber, v: string) => {
            return acc.plus(v);
          },
          mergedValue,
        );
      } else {
        accountValueExist = false;
      }

      return accountValueExist ? mergedValue.toFixed() : undefined;
    }

    if (
      linkedAccountId &&
      linkedNetworkId &&
      !networkUtils.isAllNetwork({ networkId: linkedNetworkId })
    ) {
      return value[
        accountUtils.buildAccountValueKey({
          accountId: linkedAccountId,
          networkId: linkedNetworkId,
        })
      ];
    }

    return Object.entries(value).reduce((acc, [k, v]) => {
      const keyArray = k.split('_');
      const networkId = keyArray[keyArray.length - 1];
      if (
        enabledNetworksCompatibleWithWalletId.some((n) => n.id === networkId)
      ) {
        return new BigNumber(acc ?? '0').plus(v ?? '0').toFixed();
      }
      return acc;
    }, '0');
  }, [
    value,
    linkedNetworkId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    linkedAccountId,
    enabledNetworksCompatibleWithWalletId,
  ]);

  return accountValueString ? (
    <Currency
      hideValue
      numberOfLines={1}
      flexShrink={1}
      size="$bodyMd"
      color="$textSubdued"
      sourceCurrency={currency}
    >
      {accountValueString}
    </Currency>
  ) : (
    <NumberSizeableTextWrapper
      formatter="value"
      hideValue
      size="$bodyMd"
      color="$textDisabled"
    >
      --
    </NumberSizeableTextWrapper>
  );
}

function AccountValueWithSpotlight({
  walletId,
  accountValue,
  linkedAccountId,
  linkedNetworkId,
  indexedAccountId,
  mergeDeriveAssetsEnabled,
  isSingleAddress,
}: {
  accountValue:
    | {
        accountId: string;
        currency: string | undefined;
        value: Record<string, string> | string | undefined;
      }
    | undefined;
  isOthersUniversal: boolean;
  index: number;
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
  walletId: string;
}) {
  return accountValue && accountValue.currency ? (
    <AccountValue
      walletId={walletId}
      accountId={accountValue.accountId}
      currency={accountValue.currency}
      value={accountValue.value ?? ''}
      linkedAccountId={linkedAccountId}
      linkedNetworkId={linkedNetworkId}
      indexedAccountId={indexedAccountId}
      mergeDeriveAssetsEnabled={mergeDeriveAssetsEnabled}
      isSingleAddress={isSingleAddress}
    />
  ) : (
    <NumberSizeableTextWrapper
      formatter="value"
      hideValue
      size="$bodyMd"
      color="$textDisabled"
    >
      --
    </NumberSizeableTextWrapper>
  );
}

export { AccountValue, AccountValueWithSpotlight };
