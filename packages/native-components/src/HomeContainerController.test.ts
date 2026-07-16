import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerRef,
  type IHomeContainerSnapshot,
} from './HomeContainer.types';
import { HomeContainerController } from './HomeContainerController';

const capabilities: IHomeContainerCapabilities = {
  schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
  tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
  supportsPatches: true,
  supportsAtomicPatches: true,
  supportsNativeRefresh: true,
  supportsHorizontalPaging: true,
};

function buildSnapshot(): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 4,
    selectedTabId: 'portfolio',
    header: {
      accountName: 'Account 1',
      balance: '$100',
      actions: [],
      banners: [],
    },
    tabs: [
      { id: 'portfolio', title: 'Portfolio', sections: [] },
      { id: 'perps', title: 'Perps', sections: [] },
      { id: 'defi', title: 'DeFi', sections: [] },
      { id: 'nft', title: 'NFT', sections: [] },
      { id: 'history', title: 'History', sections: [] },
    ],
    theme: {
      backgroundColor: '#FFFFFF',
      cardColor: '#F5F5F5',
      dividerColor: '#E5E5E5',
      primaryTextColor: '#111111',
      secondaryTextColor: '#666666',
      accentColor: '#5B5BD6',
      positiveColor: '#087A55',
      negativeColor: '#D92D20',
    },
  };
}

function buildTarget() {
  const target: jest.Mocked<IHomeContainerRef> = {
    setSnapshot: jest.fn(),
    applyPatch: jest.fn(),
    completeRefresh: jest.fn(),
    selectTab: jest.fn(),
    getCapabilities: jest.fn(() => capabilities),
  };
  return target;
}

describe('HomeContainerController', () => {
  it('sends a monotonic full snapshot when the native target attaches', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(true);
    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 5 }),
    );
  });

  it('coalesces same-turn tab updates into one patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    controller.updateTabSections('portfolio', [
      { id: 'assets-next', items: [] },
    ]);
    controller.updateTabSections('nft', [{ id: 'collectibles', items: [] }]);

    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(target.applyPatch).toHaveBeenCalledTimes(1);
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 6,
        tabs: [
          {
            tabId: 'portfolio',
            sections: [{ id: 'assets-next', items: [] }],
          },
          {
            tabId: 'nft',
            sections: [{ id: 'collectibles', items: [] }],
          },
        ],
      }),
    );
  });

  it('preserves the selected market category in an atomic tab patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [
      {
        id: 'market',
        title: 'Market',
        items: [
          {
            id: 'market-tabs',
            renderer: 'marketTabs',
            title: 'Market',
            segments: [
              {
                id: 'watchlist',
                title: 'Favorites',
                leadingIcon: 'star',
                iconOnly: true,
                selected: false,
                actionId: 'home.widget.market.category:watchlist',
              },
              {
                id: 'trending',
                title: 'Trending',
                selected: true,
                actionId: 'home.widget.market.category:trending',
              },
            ],
          },
        ],
      },
    ]);

    scheduled[0]();
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [
          expect.objectContaining({
            tabId: 'portfolio',
            sections: [
              expect.objectContaining({
                items: [
                  expect.objectContaining({
                    segments: [
                      expect.objectContaining({ selected: false }),
                      expect.objectContaining({ selected: true }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('folds tab and header changes into one incremental patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    controller.updateHeader({
      accountName: 'Account 2',
      balance: '$200',
      actions: [],
      banners: [],
    });

    scheduled[0]();
    expect(target.setSnapshot).not.toHaveBeenCalled();
    expect(target.applyPatch).toHaveBeenCalledTimes(1);
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 6,
        header: expect.objectContaining({ accountName: 'Account 2' }),
        tabs: [
          {
            tabId: 'portfolio',
            sections: [{ id: 'assets', items: [] }],
          },
        ],
      }),
    );
  });

  it('keeps detached updates and sends their latest state on attach', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    controller.updateTabSections('history', [{ id: 'today', items: [] }]);
    controller.attach(target);

    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: expect.arrayContaining([
          expect.objectContaining({
            id: 'history',
            sections: [{ id: 'today', items: [] }],
          }),
        ]),
      }),
    );
  });

  it('uses full snapshots for an older native patch capability', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue({
      ...capabilities,
      supportsAtomicPatches: undefined,
    });
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    scheduled[0]();

    expect(target.applyPatch).not.toHaveBeenCalled();
    expect(target.setSnapshot).toHaveBeenCalledTimes(1);
  });

  it('rejects a native target that cannot render the complete snapshot', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue({
      ...capabilities,
      tabIds: ['portfolio'],
    });
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(false);
    expect(target.setSnapshot).not.toHaveBeenCalled();
  });

  it('records native paging without issuing a second native command', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });
    controller.attach(target);

    expect(controller.recordSelectedTab('history')).toBe(true);
    expect(controller.getSnapshot().selectedTabId).toBe('history');
    expect(target.selectTab).not.toHaveBeenCalled();
  });
});
