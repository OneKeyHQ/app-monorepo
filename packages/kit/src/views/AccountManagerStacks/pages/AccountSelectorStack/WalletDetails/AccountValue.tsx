import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil, isUndefined, map } from 'lodash';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

function AccountValue(accountValue: {
  walletId: string;
  accountId: string;
  currency: string;
  value: Record<string, string> | string;
  accountDeFiOverview?: {
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
  };
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<
    string,
    {
      deriveType: IAccountDeriveTypes;
      mergeDeriveAssetsEnabled: boolean;
    }
  >;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const isActiveAccount =
    activeAccountValue?.accountId === accountValue?.accountId;

  const {
    linkedAccountId,
    linkedNetworkId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    accountDeFiOverview,
  } = accountValue;

  const { currency, value } = useMemo(() => {
    if (activeAccountValue && isActiveAccount) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue, isActiveAccount]);

  const accountValueString = useMemo(() => {
    if (typeof value === 'string') {
      return new BigNumber(value ?? '0')
        .plus(
          accountDeFiOverview?.overview?.[linkedNetworkId ?? '']?.netWorth ??
            '0',
        )
        .toFixed();
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
      const tokensValue =
        value[
          accountUtils.buildAccountValueKey({
            accountId: linkedAccountId,
            networkId: linkedNetworkId,
          })
        ];
      const accountDeFiValue =
        accountDeFiOverview?.overview?.[linkedNetworkId]?.netWorth;
      if (isUndefined(tokensValue) && isUndefined(accountDeFiValue)) {
        return undefined;
      }
      return new BigNumber(tokensValue ?? '0')
        .plus(accountDeFiValue ?? '0')
        .toFixed();
    }

    const tokensValue = Object.entries(value).reduce((acc, [k, v]) => {
      const keyArray = k.split('_');
      const networkId = keyArray.pop() as string;
      const accountId = keyArray.join('_');
      const [_walletId, _path, _deriveType] = accountId.split(SEPERATOR) as [
        string,
        string,
        string,
      ];
      const deriveType: IAccountDeriveTypes =
        (_deriveType as IAccountDeriveTypes) || 'default';
      if (
        enabledNetworksCompatibleWithWalletId.some((n) => n.id === networkId) &&
        networkInfoMap[networkId] &&
        (networkInfoMap[networkId].mergeDeriveAssetsEnabled ||
          networkInfoMap[networkId].deriveType.toLowerCase() ===
            deriveType.toLowerCase())
      ) {
        return new BigNumber(acc ?? '0').plus(v ?? '0').toFixed();
      }
      return acc;
    }, '0');

    // plus all netWorth in accountDeFiOverview
    const accountDeFiValue = Object.values(
      accountDeFiOverview?.overview ?? {},
    ).reduce((acc, curr) => {
      return new BigNumber(acc ?? '0').plus(curr?.netWorth ?? '0').toFixed();
    }, '0');
    if (isUndefined(tokensValue) && isUndefined(accountDeFiValue)) {
      return undefined;
    }
    return new BigNumber(tokensValue ?? '0')
      .plus(accountDeFiValue ?? '0')
      .toFixed();
  }, [
    value,
    linkedNetworkId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    linkedAccountId,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    accountDeFiOverview,
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
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
  accountDeFiOverview,
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
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<
    string,
    {
      deriveType: IAccountDeriveTypes;
      mergeDeriveAssetsEnabled: boolean;
    }
  >;
  accountDeFiOverview?: {
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
  };
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
      enabledNetworksCompatibleWithWalletId={
        enabledNetworksCompatibleWithWalletId
      }
      networkInfoMap={networkInfoMap}
      accountDeFiOverview={accountDeFiOverview}
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
