import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, 'PopularTrading.tsx'),
  'utf8',
);

describe('PopularTrading Store display authority', () => {
  it('reads the Market resource and dispatches typed intents without publishing', () => {
    expect(source).toContain("useHomeSectionPayload('market')");
    expect(source).toContain("useHomeResource('market')");
    expect(source).toContain('useHomeMarketIntents()');
    expect(source).toContain('onSelectCategory={selectCategory}');
    expect(source).not.toContain('useHomeStoreSourcePublisher');
    expect(source).not.toContain('publishHomeSectionSource');
  });

  it('renders rows, categories, and favorite state only from Store payload', () => {
    expect(source).toContain('tokens={displayRows}');
    expect(source).toContain('dataSource={displayRows}');
    expect(source).toContain('categories={displayHomeCategories}');
    expect(source).toContain("homeMarketPayload?.favoriteMode === 'favorites'");
    expect(source).not.toContain('tokens={categoryTokens}');
    expect(source).not.toContain('dataSource={favoriteTokens}');
    expect(source).not.toContain('setFavoriteTokens');
    expect(source).not.toContain('setWatchListItems');
    expect(source).not.toContain('setHasUserFavorites');
  });

  it('has no renderer-owned Market request, subscription, or cache lifecycle', () => {
    expect(source).not.toContain('backgroundApiProxy');
    expect(source).not.toContain('usePromiseResult');
    expect(source).not.toContain('useMarketBasicConfig');
    expect(source).not.toContain('useHomeMarketCategoryTokens');
    expect(source).not.toContain('serviceMarketV2');
    expect(source).not.toContain('pollingInterval');
    expect(source).not.toContain('RefreshMarketWatchList');
    expect(source).toContain(
      "homeMarketResource.kind === 'ready' || homeMarketResource.kind === 'empty'",
    );
  });
});
