import {
  pickProtocolInfoDisplayName,
  resolveProviderSubtitle,
} from './providerSubtitle.utils';

describe('resolveProviderSubtitle', () => {
  it('prefers providerDetail.name', () => {
    expect(
      resolveProviderSubtitle({
        title: 'USDT',
        providerDetailName: 'Morpho',
        protocolInfoDisplayName: 'Morpho Blue',
        provider: 'morpho',
      }),
    ).toBe('Morpho');
  });

  it('falls back to protocolInfo when providerDetail.name is missing', () => {
    expect(
      resolveProviderSubtitle({
        title: 'USDT',
        providerDetailName: '  ',
        protocolInfoDisplayName: 'Morpho Blue',
        provider: 'morpho',
      }),
    ).toBe('Morpho Blue');
  });

  it('falls back to the capitalized route provider as a last resort', () => {
    expect(
      resolveProviderSubtitle({
        title: 'USDT',
        providerDetailName: undefined,
        protocolInfoDisplayName: undefined,
        provider: 'morpho',
      }),
    ).toBe('Morpho');
  });

  it('drops the subtitle when it repeats the title', () => {
    expect(
      resolveProviderSubtitle({
        title: 'Lido',
        providerDetailName: 'lido',
        protocolInfoDisplayName: undefined,
        provider: 'lido',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when nothing is available', () => {
    expect(
      resolveProviderSubtitle({
        title: 'USDT',
        providerDetailName: undefined,
        protocolInfoDisplayName: undefined,
        provider: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('pickProtocolInfoDisplayName', () => {
  it('reads the first item of an array payload', () => {
    expect(
      pickProtocolInfoDisplayName([
        { title: { text: 'Morpho' } },
        { title: { text: 'Hakutora' } },
      ]),
    ).toBe('Morpho');
  });

  it('reads the wrapped items payload', () => {
    expect(
      pickProtocolInfoDisplayName({ items: [{ displayName: 'Lista' }] }),
    ).toBe('Lista');
  });

  it('falls through title -> displayName -> name', () => {
    expect(pickProtocolInfoDisplayName([{ name: { text: 'Spark' } }])).toBe(
      'Spark',
    );
  });

  it('returns undefined for an empty payload', () => {
    expect(pickProtocolInfoDisplayName(undefined)).toBeUndefined();
    expect(pickProtocolInfoDisplayName([])).toBeUndefined();
    expect(pickProtocolInfoDisplayName({ items: [{}] })).toBeUndefined();
  });
});
