import {
  MARKET_FILTER_DIMENSIONS,
  buildHotTokenFilterParams,
  pickLocalOnlyConditions,
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
