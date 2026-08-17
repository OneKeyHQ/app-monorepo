import {
  MARKET_FILTER_CHIPS,
  MARKET_FILTER_DIMENSIONS,
  buildHotTokenFilterParams,
  findActiveMarketFilterChip,
  pickLocalOnlyConditions,
  sameConditions,
} from './marketListFilterConfig';
import { EMarketFilterDimension } from './marketListFilterTypes';

import type { IMarketListFilterConditions } from './marketListFilterTypes';

// Selects the first option of every dimension, so the assertions below cover
// the whole roster rather than a hand-picked subset.
const allConditions: IMarketListFilterConditions = Object.fromEntries(
  MARKET_FILTER_DIMENSIONS.map((dimension) => [
    dimension.id,
    dimension.options[0].id,
  ]),
);

describe('market filter server passthrough split', () => {
  it('marks token age as the only client-side dimension', () => {
    expect(
      MARKET_FILTER_DIMENSIONS.filter((dimension) => dimension.isLocalOnly).map(
        (dimension) => dimension.id,
      ),
    ).toEqual([EMarketFilterDimension.TokenAge]);
  });

  it('gives every server-side dimension a param, so none can filter nothing', () => {
    MARKET_FILTER_DIMENSIONS.filter(
      (dimension) => !dimension.isLocalOnly,
    ).forEach((dimension) => {
      const params = buildHotTokenFilterParams({
        [dimension.id]: dimension.options[0].id,
      });
      expect(Object.keys(params)).not.toHaveLength(0);
    });
  });

  it('never sends a param for a client-side dimension', () => {
    const localOnly = MARKET_FILTER_DIMENSIONS.filter(
      (dimension) => dimension.isLocalOnly,
    );
    localOnly.forEach((dimension) => {
      expect(dimension.minParam).toBeUndefined();
      expect(dimension.maxParam).toBeUndefined();
      expect(
        buildHotTokenFilterParams({
          [dimension.id]: dimension.options[0].id,
        }),
      ).toEqual({});
    });
  });

  it('keeps only token age for the local pass when everything is selected', () => {
    expect(Object.keys(pickLocalOnlyConditions(allConditions))).toEqual([
      EMarketFilterDimension.TokenAge,
    ]);
  });

  it('routes each selected dimension to exactly one of the two passes', () => {
    const serverParamCount = Object.keys(
      buildHotTokenFilterParams(allConditions),
    ).length;
    const localCount = Object.keys(
      pickLocalOnlyConditions(allConditions),
    ).length;
    expect(serverParamCount + localCount).toBe(MARKET_FILTER_DIMENSIONS.length);
  });
});

// The Filters modal calls onApply only when this reports a change, because
// applying conditions resets the sort. A false negative here silently drops
// the user's sort on an unchanged Confirm.
describe('sameConditions', () => {
  const base: IMarketListFilterConditions = {
    [EMarketFilterDimension.Holders]: 'min-1000',
  };

  it('treats an untouched draft as unchanged', () => {
    expect(sameConditions({ ...base }, base)).toBe(true);
    expect(sameConditions({}, {})).toBe(true);
  });

  it('detects an added, removed or retargeted dimension', () => {
    expect(sameConditions({}, base)).toBe(false);
    expect(sameConditions(base, {})).toBe(false);
    expect(
      sameConditions({ [EMarketFilterDimension.Holders]: 'min-10000' }, base),
    ).toBe(false);
  });

  it('ignores key order', () => {
    const a: IMarketListFilterConditions = {
      [EMarketFilterDimension.Holders]: 'min-1000',
      [EMarketFilterDimension.MarketCap]: 'min-500k',
    };
    const b: IMarketListFilterConditions = {
      [EMarketFilterDimension.MarketCap]: 'min-500k',
      [EMarketFilterDimension.Holders]: 'min-1000',
    };
    expect(sameConditions(a, b)).toBe(true);
  });
});

describe('findActiveMarketFilterChip time frame anchoring', () => {
  // The sort-bearing chip is the one that anchors a window, so it is the case
  // that can drift: its icon and its descending-only lock are derived from
  // preset identity, and both would keep applying after the user moves the
  // toolbar off the anchor.
  const anchored = MARKET_FILTER_CHIPS.find((chip) => chip.timeRange);

  it('has at least one time-anchored chip to guard', () => {
    expect(anchored).toBeDefined();
  });

  it('matches while the window still equals the anchor', () => {
    if (!anchored) return;
    expect(
      findActiveMarketFilterChip(
        anchored.conditions,
        anchored.sort ?? {},
        anchored.timeRange,
      ),
    ).toBe(anchored);
  });

  it('stops matching once the window moves away from the anchor', () => {
    if (!anchored) return;
    const otherWindow = anchored.timeRange === '24h' ? '1h' : '24h';
    expect(
      findActiveMarketFilterChip(
        anchored.conditions,
        anchored.sort ?? {},
        otherWindow,
      ),
    ).toBeUndefined();
  });

  it('ignores the window when the caller passes none', () => {
    if (!anchored) return;
    expect(
      findActiveMarketFilterChip(anchored.conditions, anchored.sort ?? {}),
    ).toBe(anchored);
  });
});
