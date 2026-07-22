import { buildMobileNativeHomeSections } from './mobileNativeHomeProjector';

const presentation = {
  labels: {
    loading: 'Loading',
    noData: 'No data',
    popular: 'Popular',
    positions: 'Positions',
    tokens: 'Tokens',
    unableToLoad: 'Unable to load',
  },
  locale: 'en-US',
};

describe('mobileNativeHomeProjector', () => {
  it('projects semantic loading and hidden states without renderer-owned data', () => {
    expect(
      buildMobileNativeHomeSections({
        ...presentation,
        payloads: {},
        sectionId: 'defi',
        semantic: { kind: 'loading', placeholder: 'defi' },
      }),
    ).toEqual([
      {
        id: 'defi-state',
        items: [
          expect.objectContaining({
            id: 'defi-state-item',
            renderer: 'loading',
          }),
        ],
      },
    ]);
    expect(
      buildMobileNativeHomeSections({
        ...presentation,
        payloads: {},
        sectionId: 'defi',
        semantic: { kind: 'hidden', reason: 'notApplicable' },
      }),
    ).toEqual([]);
  });

  it('projects ready sections only from their Store payload', () => {
    expect(
      buildMobileNativeHomeSections({
        ...presentation,
        payloads: {},
        sectionId: 'portfolio',
        semantic: {
          kind: 'ready',
          rowIds: [],
          freshness: 'live',
          refresh: 'idle',
        },
      }),
    ).toEqual([{ id: 'portfolio-assets', title: 'Tokens', items: [] }]);
  });
});
