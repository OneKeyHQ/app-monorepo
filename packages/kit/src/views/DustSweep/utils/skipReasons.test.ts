import type {
  IDustSweepItem,
  IDustSweepReason,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { groupDustSweepSkips } from './skipReasons';

function item(
  key: string,
  status: IDustSweepItem['status'],
  reason?: IDustSweepReason,
  providerErrorMessage?: string,
): IDustSweepItem {
  return {
    token: {
      key,
      networkId: 'evm--1',
      contractAddress: key,
      symbol: key,
      decimals: 18,
      amount: '1',
      valueUsd: '1',
      suspicious: false,
    },
    status,
    reason,
    providerErrorMessage,
  };
}

// Stands in for the token row's reason text.
const labelOf = (entry: IDustSweepItem) =>
  entry.providerErrorMessage?.trim() || entry.reason || 'unknown';

const groupsOf = (items: IDustSweepItem[]) =>
  groupDustSweepSkips(items, labelOf).map((group) => [
    group.label ?? 'others',
    group.tokens.map((token) => token.key).join(','),
  ]);

it('groups skipped and failed tokens by their row text, most common first', () => {
  expect(
    groupsOf([
      item('a', 'success'),
      item('b', 'skipped', 'noQuote'),
      item('c', 'skipped', 'insufficientGas'),
      item('d', 'skipped', 'insufficientGas'),
      item('e', 'failed', 'txFailed'),
    ]),
  ).toEqual([
    ['insufficientGas', 'c,d'],
    ['noQuote', 'b'],
    ['txFailed', 'e'],
  ]);
});

it('keeps the top two reasons and merges the rest into others past three', () => {
  expect(
    groupsOf([
      item('a', 'skipped', 'insufficientGas'),
      item('b', 'skipped', 'insufficientGas'),
      item('c', 'skipped', 'insufficientGas'),
      item('d', 'skipped', 'unknown'),
      item('e', 'skipped', 'unknown'),
      item('f', 'skipped', 'noQuote'),
      item('g', 'skipped', 'priceImpact'),
    ]),
  ).toEqual([
    ['insufficientGas', 'a,b,c'],
    ['unknown', 'd,e'],
    ['others', 'f,g'],
  ]);
});

it('splits the same reason when the rows show different text', () => {
  expect(
    groupsOf([
      item('a', 'skipped', 'noQuote', '请增加金额后重试'),
      item('b', 'skipped', 'noQuote'),
      item('c', 'skipped', 'noQuote', ' 请增加金额后重试 '),
    ]),
  ).toEqual([
    ['请增加金额后重试', 'a,c'],
    ['noQuote', 'b'],
  ]);
});

it('returns nothing when every token converted', () => {
  expect(groupDustSweepSkips([item('a', 'success')], labelOf)).toEqual([]);
});
