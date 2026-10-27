import BigNumber from 'bignumber.js';

import chainValueUtils from './chainValueUtils';

import type { IServerNetwork } from '../../types';

/*
yarn jest packages/shared/src/utils/chainValueUtils.test.ts
*/

const osmosis = { decimals: 6 } as IServerNetwork;
const ethereum = { decimals: 18 } as IServerNetwork;

describe('chainValueUtils.floorNativeTokenAmount', () => {
  it('floors a max-send preview to the network decimals (OK-61701)', () => {
    // 24.505172 OSMO balance minus a 3117.58 uosmo fee (gasPrice × gasLimit
    // resolves to fractional base units on Cosmos chains).
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: '24.50205442',
        network: osmosis,
      }),
    ).toBe('24.502054');
  });

  it('never rounds up', () => {
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: '1.9999999',
        network: osmosis,
      }),
    ).toBe('1.999999');
  });

  it('keeps representable amounts unchanged', () => {
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: '24.502054',
        network: osmosis,
      }),
    ).toBe('24.502054');
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: '1.5',
        network: osmosis,
      }),
    ).toBe('1.5');
    expect(
      chainValueUtils.floorNativeTokenAmount({ amount: '0', network: osmosis }),
    ).toBe('0');
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: '0.123456789012345678',
        network: ethereum,
      }),
    ).toBe('0.123456789012345678');
  });

  it('accepts BigNumber input and never uses exponential notation', () => {
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: new BigNumber('0.0000001'),
        network: osmosis,
      }),
    ).toBe('0');
    expect(
      chainValueUtils.floorNativeTokenAmount({
        amount: new BigNumber('123456789.1234567'),
        network: osmosis,
      }),
    ).toBe('123456789.123456');
  });
});
