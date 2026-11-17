import {
  EUniversalSearchSource,
  EUniversalSearchType,
} from '@onekeyhq/shared/types/search';

import { SearchScene } from './search';

describe('SearchScene', () => {
  it('keeps the source on universal search query events', () => {
    const scene = new SearchScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    const params = {
      source: EUniversalSearchSource.Wallet,
      searchText: 'one',
      resultCount: 2,
      exposedTypes: 'market:2',
    };

    scene.universalSearchQuery(params);

    expect(emitLog).toHaveBeenCalledWith(
      'universalSearchQuery',
      [params],
      expect.arrayContaining([
        expect.objectContaining({ type: 'server' }),
        expect.objectContaining({ type: 'local' }),
      ]),
    );
  });

  it('keeps the source while normalizing click result types', () => {
    const scene = new SearchScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);

    scene.universalSearchClick({
      source: EUniversalSearchSource.Browser,
      searchText: 'eth',
      type: EUniversalSearchType.V2MarketToken,
      itemId: 'eth',
      itemTitle: 'ETH',
    });

    expect(emitLog).toHaveBeenCalledWith(
      'universalSearchClick',
      [
        {
          source: EUniversalSearchSource.Browser,
          searchText: 'eth',
          type: 'market',
          itemId: 'eth',
          itemTitle: 'ETH',
        },
      ],
      expect.arrayContaining([
        expect.objectContaining({ type: 'server' }),
        expect.objectContaining({ type: 'local' }),
      ]),
    );
  });
});
