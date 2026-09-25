import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function pickAccountRecord<T>(
  record: Record<string, T> | undefined,
  key: string,
): Record<string, T> {
  return record && Object.prototype.hasOwnProperty.call(record, key)
    ? { [key]: record[key] }
    : {};
}

export function projectHomeAccountLocalTokens({
  rawData,
  networkId,
  accountAddress,
  xpub,
}: {
  rawData: ISimpleDBLocalTokens | null | undefined;
  networkId: string;
  accountAddress?: string;
  xpub?: string;
}): ISimpleDBLocalTokens | undefined {
  if (!rawData) {
    return undefined;
  }
  const key = accountUtils.buildAccountLocalAssetsKey({
    networkId,
    accountAddress,
    xpub,
  });

  // Keep the run's snapshot, but avoid sending every account back to bg for
  // each network. An absent tokenList key must stay absent: it means no cache.
  return {
    data: {},
    tokenList: pickAccountRecord(rawData.tokenList, key),
    smallBalanceTokenList: pickAccountRecord(
      rawData.smallBalanceTokenList,
      key,
    ),
    riskyTokenList: pickAccountRecord(rawData.riskyTokenList, key),
    tokenListMap: pickAccountRecord(rawData.tokenListMap, key),
    tokenListValue: pickAccountRecord(rawData.tokenListValue, key),
    tokenListCurrency: rawData.tokenListCurrency
      ? pickAccountRecord(rawData.tokenListCurrency, key)
      : undefined,
  };
}
