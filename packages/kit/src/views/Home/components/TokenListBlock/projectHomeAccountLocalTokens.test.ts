import {
  type ISimpleDBLocalTokens,
  SimpleDbEntityLocalTokens,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { projectHomeAccountLocalTokens } from './projectHomeAccountLocalTokens';

const target = { networkId: 'evm--1', accountAddress: '0xAccountA' };
const targetKey = accountUtils.buildAccountLocalAssetsKey(target);
const otherKey = accountUtils.buildAccountLocalAssetsKey({
  ...target,
  accountAddress: '0xAccountB',
});

function makeToken(symbol: string): IAccountToken {
  return {
    $key: symbol,
    name: symbol,
    symbol,
    decimals: 18,
    address: symbol,
    isNative: false,
  };
}

function makeSnapshot(): ISimpleDBLocalTokens {
  const token = makeToken('target-token');
  const other = makeToken('other-token');
  return {
    data: { metadata: other },
    tokenList: { [targetKey]: [token], [otherKey]: [other] },
    smallBalanceTokenList: {
      [targetKey]: [makeToken('small')],
      [otherKey]: [other],
    },
    riskyTokenList: {
      [targetKey]: [makeToken('risky')],
      [otherKey]: [other],
    },
    tokenListMap: {
      [targetKey]: {
        [token.$key]: {
          balance: '2',
          balanceParsed: '2',
          fiatValue: '6',
          price: 3,
        },
      },
      [otherKey]: {},
    },
    tokenListValue: { [targetKey]: '6', [otherKey]: '9' },
    tokenListCurrency: { [targetKey]: 'eur', [otherKey]: 'usd' },
  };
}

function serializeSnapshot(rawData: ISimpleDBLocalTokens) {
  return JSON.parse(JSON.stringify(rawData)) as ISimpleDBLocalTokens;
}

describe('projectHomeAccountLocalTokens', () => {
  const entity = new SimpleDbEntityLocalTokens();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the background cache response while excluding unrelated accounts and metadata', async () => {
    const snapshot = makeSnapshot();
    const original = JSON.stringify(snapshot);
    const getRawData = jest.spyOn(entity, 'getRawData');
    const projected = projectHomeAccountLocalTokens({
      ...target,
      rawData: snapshot,
    });
    expect(projected).toBeDefined();
    if (!projected) throw new OneKeyLocalError('Expected a projected snapshot');

    const read = (rawData: ISimpleDBLocalTokens) =>
      entity.getAccountTokenList({
        ...target,
        simpleDbLocalTokensRawData: serializeSnapshot(rawData),
      });
    await expect(read(projected)).resolves.toEqual(await read(snapshot));
    expect(getRawData).not.toHaveBeenCalled();
    expect(projected.data).toEqual({});
    for (const record of Object.values(projected)) {
      expect(Object.prototype.hasOwnProperty.call(record, otherKey)).toBe(
        false,
      );
    }
    expect(projected.tokenList[targetKey]).toBe(snapshot.tokenList[targetKey]);
    expect(JSON.stringify(snapshot)).toBe(original);
  });

  it.each([false, true])(
    'preserves hasCache for a missing or cached-empty account (cached=%s)',
    async (cached) => {
      const snapshot = makeSnapshot();
      if (cached) {
        snapshot.tokenList[targetKey] = [];
      } else {
        delete snapshot.tokenList[targetKey];
      }
      const projected = projectHomeAccountLocalTokens({
        ...target,
        rawData: snapshot,
      });
      if (!projected)
        throw new OneKeyLocalError('Expected a projected snapshot');
      const getRawData = jest.spyOn(entity, 'getRawData');

      await expect(
        entity.getAccountTokenList({
          ...target,
          simpleDbLocalTokensRawData: serializeSnapshot(projected),
        }),
      ).resolves.toMatchObject({ hasCache: cached, tokenList: [] });
      expect(getRawData).not.toHaveBeenCalled();
    },
  );

  it('uses the normalized xpub key instead of the address or another network', async () => {
    const snapshot = makeSnapshot();
    const params = {
      networkId: 'btc--0',
      accountAddress: 'UnusedAddress',
      xpub: 'XPUB-Owner',
    };
    const xpubKey = accountUtils.buildAccountLocalAssetsKey(params);
    snapshot.tokenList[xpubKey] = [makeToken('btc-owner')];
    snapshot.tokenList['btc--0_unusedaddress'] = [makeToken('address-decoy')];
    snapshot.tokenList['btc--1_xpub-owner'] = [makeToken('network-decoy')];
    snapshot.tokenListCurrency = {
      ...snapshot.tokenListCurrency,
      [xpubKey]: 'jpy',
    };
    const projected = projectHomeAccountLocalTokens({
      ...params,
      rawData: snapshot,
    });
    if (!projected) throw new OneKeyLocalError('Expected a projected snapshot');

    expect(Object.keys(projected.tokenList)).toEqual([xpubKey]);
    await expect(
      entity.getAccountTokenList({
        ...params,
        simpleDbLocalTokensRawData: serializeSnapshot(projected),
      }),
    ).resolves.toMatchObject({
      tokenList: snapshot.tokenList[xpubKey],
      currency: 'jpy',
      hasCache: true,
    });
  });

  it('keeps an untagged legacy cache untagged', async () => {
    const snapshot = makeSnapshot();
    delete snapshot.tokenListCurrency;
    const projected = projectHomeAccountLocalTokens({
      ...target,
      rawData: snapshot,
    });
    if (!projected) throw new OneKeyLocalError('Expected a projected snapshot');

    await expect(
      entity.getAccountTokenList({
        ...target,
        simpleDbLocalTokensRawData: serializeSnapshot(projected),
      }),
    ).resolves.toMatchObject({ currency: undefined });
  });

  it.each([null, undefined])(
    'preserves an unavailable snapshot (%s) so the existing background fallback remains available',
    (rawData) => {
      expect(
        projectHomeAccountLocalTokens({ ...target, rawData }),
      ).toBeUndefined();
    },
  );
});
