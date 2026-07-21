import fs from 'fs';
import path from 'path';

describe('PerpsContainer Store display authority', () => {
  it('renders business state only from the Home Store projection', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'PerpsContainer.tsx'),
      'utf8',
    );
    const containerSource = source.slice(
      source.indexOf('export function PerpsContainer()'),
    );

    expect(containerSource).toContain('const view = perpsPayload?.view');
    expect(containerSource).toContain(
      'const canDeposit = Boolean(perpsPayload?.address)',
    );
    expect(containerSource).not.toContain('perpsPortfolio.view');
    expect(containerSource).not.toContain('perpsPortfolio.viewState');
    expect(containerSource).not.toContain('perpsPortfolio.canDeposit');
    expect(containerSource).not.toContain('usePerpsHomePortfolio');
    expect(containerSource).not.toContain(
      'useRegisterHomeBackgroundRecoveryRefresh',
    );
    expect(containerSource).not.toContain('publishHomeSectionSource');
  });

  it('keeps unresolved Store state loading without a local-result fallback', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'PerpsContainer.tsx'),
      'utf8',
    );
    const containerSource = source.slice(
      source.indexOf('export function PerpsContainer()'),
    );

    expect(containerSource).toContain(
      "let viewState: 'ready' | 'loading' | 'empty' = 'loading'",
    );
    expect(containerSource).toContain("viewState = 'empty'");
    expect(containerSource).not.toContain('storeHasDisplayAuthority');
  });

  it('does not start a second Market/Perps data source from the renderer', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'PerpsContainer.tsx'),
      'utf8',
    );

    expect(source).toContain("useHomeResource('market')");
    expect(source).toContain("useHomeSectionPayload('market')");
    expect(source).toContain('marketPayload?.perpsHotRows');
    expect(source).not.toContain('useMarketPerpsTokenList');
    expect(source).not.toContain('useHomeMarketCategoryTokens');
    expect(source).not.toContain('backgroundApiProxy');
  });
});
