/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/networks';

import Vault from './Vault';

const T1 = 't1UYsZVJkLPeMjxEtACvSxfWuNmddpWfxzs';
const T3 = 't3JZcvsuaXE6ygokL4XUiZSTrQBUoPYFnXJ';
const TEX = 'tex1pyysjzgfpyysjzgfpyysjzgfpyysjzgfl7c006';
const UNIFIED =
  'u1y2z9wqt9du4stq2keex78l4vvlkfh3c0n7le0pz80lc4ttcuz5h9qyts73awns77lkgw8zy67qwf0s86rauwg6e9wz7te7yf6vxjtk5g';

function createVault() {
  const vault = Object.create(Vault.prototype) as Vault;
  jest
    .spyOn(vault, 'getBtcForkNetwork')
    .mockResolvedValue(getBtcForkNetwork('zec'));
  return vault;
}

// Watch-only reads balances from the backend and never scans, so only t1 can be watched.
describe('zcash watch-only addresses', () => {
  it('watches a t1 address', async () => {
    await expect(
      createVault().validateWatchingAddress(T1),
    ).resolves.toMatchObject({ isValid: true, normalizedAddress: T1 });
  });

  it.each([T3, TEX, UNIFIED])(
    'refuses to watch %s while still taking it as a recipient',
    async (address) => {
      const vault = createVault();
      await expect(vault.validateAddress(address)).resolves.toMatchObject({
        isValid: true,
      });
      await expect(vault.validateWatchingAddress(address)).resolves.toEqual({
        isValid: false,
        normalizedAddress: '',
        displayAddress: '',
      });
    },
  );
});
