import BigNumber from 'bignumber.js';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import type {
  IAccountSelectorDeFiItem,
  IAccountSelectorValueItem,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  numberFormat,
  numberFormatAsRenderText,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICurrencyItem, IServerNetwork } from '@onekeyhq/shared/types';

import type { SelectorTextSegment } from '@onekeyfe/react-native-native-list';

type IAccountValueV2 = {
  accountValue?: IAccountSelectorValueItem;
  activeAccountValue?: {
    accountId: string;
    currency: string;
    value: Record<string, string> | string;
  };
  overview?: IAccountSelectorDeFiItem;
  walletId: string;
  linkedAccountId: string;
  linkedNetworkId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<string, INetworkDeriveInfo>;
  currencyMap: Record<string, ICurrencyItem>;
  targetCurrency: string;
  hideValue: boolean;
};

export function formatAccountSelectorValueV2({
  accountValue,
  activeAccountValue,
  overview,
  walletId,
  linkedAccountId,
  linkedNetworkId,
  mergeDeriveAssetsEnabled,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
  currencyMap,
  targetCurrency,
  hideValue,
}: IAccountValueV2): SelectorTextSegment {
  if (!accountValue?.currency)
    return { text: hideValue ? '****' : '--', tone: 'disabled' };
  const resolved =
    activeAccountValue?.accountId === accountValue.accountId
      ? activeAccountValue
      : accountValue;
  const currency = resolved.currency ?? accountValue.currency;
  const value = resolved.value ?? '';
  const perpsNetWorth =
    overview?.perpsNetWorthUsd && currency
      ? convertFiat({
          value: overview.perpsNetWorthUsd,
          sourceCurrency: USD_CURRENCY_ID,
          targetCurrency: currency,
          currencyMap,
        })
      : '0';
  let total: string | undefined;
  if (typeof value === 'string') {
    total = calculateAccountTotalValue({
      tokensValue: value,
      deFiNetWorth: new BigNumber(
        overview?.overview?.[linkedNetworkId ?? '']?.netWorth ?? '0',
      )
        .plus(perpsNetWorth)
        .toFixed(),
    });
  } else if (linkedNetworkId && mergeDeriveAssetsEnabled) {
    total = calculateAccountTotalValue({
      tokensValue: value,
      deFiNetWorth: 0,
      mergeDeriveAssetsEnabled: true,
      networkId: linkedNetworkId,
    });
  } else if (
    linkedAccountId &&
    linkedNetworkId &&
    !networkUtils.isAllNetwork({ networkId: linkedNetworkId })
  ) {
    const deFiRaw = overview?.overview?.[linkedNetworkId]?.netWorth;
    total = calculateAccountTotalValue({
      tokensValue: value,
      deFiNetWorth:
        deFiRaw === undefined && overview?.perpsNetWorthUsd === undefined
          ? undefined
          : new BigNumber(deFiRaw ?? '0').plus(perpsNetWorth).toFixed(),
      accountId: linkedAccountId,
      networkId: linkedNetworkId,
    });
  } else {
    const deFiAll = Object.values(overview?.overview ?? {}).reduce(
      (sum, current) =>
        new BigNumber(sum).plus(current?.netWorth ?? '0').toFixed(),
      perpsNetWorth,
    );
    total = calculateAccountTotalValue({
      tokensValue: value,
      deFiNetWorth: deFiAll,
      walletId,
      enabledNetworksCompatibleWithWalletId,
      networkInfoMap,
    });
  }
  if (!total) return { text: hideValue ? '****' : '--', tone: 'disabled' };
  if (hideValue) return { text: '****', tone: 'secondary' };
  const converted =
    total === '--'
      ? total
      : convertFiat({
          value: total,
          sourceCurrency: currency,
          targetCurrency,
          currencyMap,
        });
  const formatted =
    converted === '--'
      ? converted
      : numberFormatAsRenderText(converted, {
          formatter: 'price',
          formatterOptions: {
            currency:
              currencyMap[targetCurrency]?.unit ?? currencyMap[currency]?.unit,
          },
        });
  if (typeof formatted === 'string')
    return { text: formatted, tone: 'secondary' };
  const textSegments = formatted.map((part) =>
    typeof part === 'string'
      ? { text: part }
      : { text: String(part.value), style: 'subscript' as const },
  );
  return {
    text: numberFormat(converted, {
      formatter: 'price',
      formatterOptions: {
        currency:
          currencyMap[targetCurrency]?.unit ?? currencyMap[currency]?.unit,
      },
    }),
    textSegments,
    tone: 'secondary',
  };
}
