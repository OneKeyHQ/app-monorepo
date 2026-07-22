import fs from 'fs';
import path from 'path';

import { isHomePerpsSourceActive } from './homePerpsStoreControllerPolicy';

describe('HomePerpsStoreController ownership', () => {
  it('activates the source whenever Store exposes the Perps contributor', () => {
    expect(isHomePerpsSourceActive({ kind: 'hidden' })).toBe(false);
    expect(
      isHomePerpsSourceActive({
        kind: 'ready',
        tabs: ['portfolio', 'perps'],
        selectedTabId: 'portfolio',
      }),
    ).toBe(true);
    expect(
      isHomePerpsSourceActive({
        kind: 'ready',
        tabs: ['portfolio', 'perps'],
        selectedTabId: 'perps',
      }),
    ).toBe(true);
  });

  it('owns the producer and background recovery registration', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomePerpsStoreController.tsx'),
      'utf8',
    );

    expect(source).toContain('const navigation = useHomeNavigation()');
    expect(source).toContain(
      'const { refresh } = usePerpsHomePortfolio({ isSourceActive })',
    );
    expect(source).toContain('useRegisterHomeBackgroundRecoveryRefresh({');
    expect(source).toContain(
      'domain: EHomeBackgroundRecoveryRefreshDomain.perps',
    );
    expect(source).toContain("operationKey: 'home-perps-store-source'");
    expect(source).not.toContain('useTabIsRefreshingFocused');
  });
});
