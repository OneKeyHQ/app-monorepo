import { HOME_CONTAINER_SCHEMA_VERSION } from './HomeContainer.types';
import { HomeContainerController } from './HomeContainerController';
import { HOME_CONTAINER_PROTOCOL_V3_VERSION } from './HomeContainerProtocolV3';

import type {
  IHomeContainerCapabilities,
  IHomeContainerRef,
  IHomeContainerSnapshot,
} from './HomeContainer.types';

const capabilities: IHomeContainerCapabilities = {
  schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
  protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
  tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
  supportsNativeRefresh: true,
  supportsHorizontalPaging: true,
  supportsSlots: true,
};

const initialSnapshot: IHomeContainerSnapshot = {
  schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
  revision: 0,
  selectedTabId: 'portfolio',
  header: {
    accountName: 'Account 1',
    balance: '$1',
    actions: [],
    banners: [],
  },
  tabs: [
    {
      id: 'portfolio',
      title: 'Spot',
      destination: 'inline',
      sections: [],
    },
    {
      id: 'perps',
      title: 'Perps',
      destination: 'inline',
      sections: [],
    },
  ],
  theme: {
    backgroundColor: '#fff',
    cardColor: '#eee',
    dividerColor: '#ddd',
    primaryTextColor: '#111',
    secondaryTextColor: '#666',
    accentColor: '#55f',
    positiveColor: '#080',
    negativeColor: '#f00',
  },
};

function target(): jest.Mocked<IHomeContainerRef> {
  return {
    completeRefresh: jest.fn(),
    getCapabilities: jest.fn(() => capabilities),
    selectTab: jest.fn(),
    setDomains: jest.fn(),
    setSnapshot: jest.fn(),
  };
}

function setup() {
  const scheduled: Array<() => void> = [];
  const controller = new HomeContainerController({
    initialOwner: {
      scopeKey: 'wallet:account-1:all',
      sessionId: 'session-1',
    },
    initialSnapshot,
    schedule: (flush) => scheduled.push(flush),
  });
  const nativeTarget = target();
  expect(controller.attach(nativeTarget, capabilities)).toBe(true);
  nativeTarget.setSnapshot.mockClear();
  return { controller, nativeTarget, scheduled };
}

describe('HomeContainerController', () => {
  it('coalesces the latest same-domain value into one frame batch', () => {
    const { controller, nativeTarget, scheduled } = setup();
    controller.updateHeader({
      ...initialSnapshot.header,
      balance: '$2',
    });
    controller.updateHeader({
      ...initialSnapshot.header,
      balance: '$3',
    });

    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(nativeTarget.setDomains).toHaveBeenCalledTimes(1);
    expect(nativeTarget.setDomains.mock.calls[0][0].updates).toEqual([
      expect.objectContaining({
        kind: 'shell',
        value: expect.objectContaining({ balance: '$3' }),
      }),
    ]);
  });

  it('batches independent domains without a global sequence dependency', () => {
    const { controller, nativeTarget, scheduled } = setup();
    controller.updateHeader({
      ...initialSnapshot.header,
      balance: '$2',
    });
    controller.updateTabSections('perps', [{ id: 'positions', items: [] }]);

    scheduled[0]();
    expect(
      nativeTarget.setDomains.mock.calls[0][0].updates.map(
        (update) => update.kind,
      ),
    ).toEqual(['shell', 'section']);
  });

  it('uses controller-owned domain generations with external authority state', () => {
    const scheduled: Array<() => void> = [];
    const controller = new HomeContainerController({
      initialOwner: {
        scopeKey: 'wallet:account-1:all',
        sessionId: 'session-1',
      },
      initialSnapshot,
      initialProtocolV3AuthorityState: {
        storeCommitId: 7,
        authorityRevisions: {
          shellCommands: 2,
          tabApplicability: 3,
          sectionCommands: {
            portfolio: 4,
            perps: 5,
            defi: 0,
            nft: 0,
            history: 0,
            market: 6,
          },
        },
      },
      schedule: (flush) => scheduled.push(flush),
    });
    const nativeTarget = target();
    controller.attach(nativeTarget, capabilities);
    nativeTarget.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'tokens', items: [] }]);
    controller.updateTabSections('portfolio', [
      { id: 'tokens-and-market', items: [] },
    ]);
    scheduled[0]();

    expect(nativeTarget.setDomains).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: [
          expect.objectContaining({
            kind: 'section',
            tabId: 'portfolio',
            presentationRevision: 2,
            value: [{ id: 'tokens-and-market', items: [] }],
          }),
        ],
      }),
    );
  });

  it('publishes sections for a newly introduced inline tab', () => {
    const { controller, nativeTarget, scheduled } = setup();
    controller.updateTabs([
      ...initialSnapshot.tabs,
      {
        id: 'defi',
        title: 'DeFi',
        destination: 'inline',
        sections: [{ id: 'protocols', items: [] }],
      },
    ]);

    scheduled[0]();
    expect(nativeTarget.setDomains.mock.calls[0][0].updates).toEqual([
      expect.objectContaining({
        kind: 'navigation',
        presentationRevision: 1,
      }),
      expect.objectContaining({
        kind: 'section',
        tabId: 'defi',
        presentationRevision: 1,
        value: [{ id: 'protocols', items: [] }],
      }),
    ]);
  });

  it('drops pending old-owner domains and publishes one new-owner snapshot', () => {
    const { controller, nativeTarget, scheduled } = setup();
    controller.updateHeader({
      ...initialSnapshot.header,
      balance: '$2',
    });
    controller.replaceOwner(
      {
        scopeKey: 'wallet:account-2:all',
        sessionId: 'session-2',
      },
      {
        ...initialSnapshot,
        header: {
          ...initialSnapshot.header,
          accountName: 'Account 2',
        },
      },
    );

    scheduled[0]();
    expect(nativeTarget.setDomains).not.toHaveBeenCalled();
    expect(nativeTarget.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({
          scopeKey: 'wallet:account-2:all',
          sessionId: 'session-2',
        }),
      }),
    );
  });
});
