import { type ReactNode, createRef } from 'react';

import TestRenderer, { act } from 'react-test-renderer';

import { HomeContainer } from './HomeContainer.native';
import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerRef,
} from './HomeContainer.types';
import { HOME_CONTAINER_PROTOCOL_V3_VERSION } from './HomeContainerProtocolV3';

import type {
  IHomeContainerDomainBatchV3,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    StyleSheet: {
      absoluteFillObject: {},
      create: <T,>(styles: T) => styles,
    },
    View: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children),
    useWindowDimensions: () => ({ height: 874, width: 402 }),
  };
});

const mockNativeView = {
  completeRefresh: jest.fn(),
  getCapabilities: jest.fn(() =>
    JSON.stringify({
      schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
      supportsNativeRefresh: true,
      supportsHorizontalPaging: true,
      supportsSlots: true,
    }),
  ),
  selectTab: jest.fn(),
  setDomains: jest.fn(),
  setSnapshot: jest.fn(),
};

let mockHostProps:
  | {
      hybridRef?: (view: typeof mockNativeView) => void;
      initialSnapshotJson?: string;
      onVisibleTabChange?: (tabId: string) => void;
    }
  | undefined;
const mockSlotRenderCounts = new Map<string, number>();

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    hasHybridObject: jest.fn(() => true),
  },
  callback: jest.fn((callbackValue: unknown) => callbackValue),
  getHostComponent: jest.fn(
    () =>
      function MockHomeContainerHost(props: NonNullable<typeof mockHostProps>) {
        const React = jest.requireActual<typeof import('react')>('react');
        const { hybridRef } = props;
        mockHostProps = props;
        React.useLayoutEffect(() => {
          hybridRef?.(mockNativeView);
        }, [hybridRef]);
        return React.createElement('View', {
          testID: 'MockHomeContainerHost',
        });
      },
  ),
}));

jest.mock('./HomeContainerSlotNativeComponent', () => ({
  __esModule: true,
  default: ({
    children,
    slotKey,
    ...props
  }: {
    children?: ReactNode;
    slotKey: string;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    mockSlotRenderCounts.set(
      slotKey,
      (mockSlotRenderCounts.get(slotKey) ?? 0) + 1,
    );
    return React.createElement('View', { ...props, slotKey }, children);
  },
}));

jest.mock('./HomeContainerSurfaceNativeComponent', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children?: ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('View', props, children);
  },
}));

const tabRevisions = {
  portfolio: 0,
  perps: 0,
  defi: 0,
  nft: 0,
  history: 0,
} as const;

const sectionRevisions = {
  ...tabRevisions,
  market: 0,
} as const;

const snapshot: IHomeContainerSnapshotEnvelopeV3 = {
  kind: 'snapshot',
  protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
  identity: {
    scopeKey: 'wallet:account:all',
    sessionId: 'session-1',
    storeCommitId: 0,
  },
  presentationRevisions: {
    shell: 0,
    navigation: 0,
    surface: 0,
    sections: tabRevisions,
  },
  authorityRevisions: {
    shellCommands: 0,
    tabApplicability: 0,
    sectionCommands: sectionRevisions,
  },
  payload: {
    selectedTabId: 'portfolio',
    header: {
      accountName: 'Account',
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
  },
};

describe('HomeContainer native wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHostProps = undefined;
    mockSlotRenderCounts.clear();
  });

  it('submits only the current protocol snapshot at mount', async () => {
    await act(async () => {
      TestRenderer.create(<HomeContainer initialSnapshot={snapshot} />);
    });
    expect(JSON.parse(mockHostProps?.initialSnapshotJson ?? '')).toEqual(
      snapshot,
    );
  });

  it('forwards domain batches immediately without waiting for React slots', async () => {
    const ref = createRef<IHomeContainerRef>();
    await act(async () => {
      TestRenderer.create(
        <HomeContainer
          ref={ref}
          initialSnapshot={snapshot}
          slotBundle={{
            owner: snapshot.identity,
            phase: 'stable',
            semanticRevision: 1,
            slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
            slots: {
              balance: {
                content: 'Balance',
                contentRevision: 'balance',
                height: 58,
              },
            },
          }}
        />,
      );
    });
    const batch: IHomeContainerDomainBatchV3 = {
      kind: 'domains',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: {
        ...snapshot.identity,
        storeCommitId: 2,
      },
      updates: [
        {
          kind: 'surface',
          presentationRevision: 2,
          value: snapshot.payload.theme,
        },
      ],
    };

    act(() => {
      ref.current?.setDomains(batch);
    });

    expect(mockNativeView.setDomains).toHaveBeenCalledWith(
      JSON.stringify(batch),
    );
  });

  it('publishes current capabilities after the native ref is committed', async () => {
    const onReady = jest.fn();
    await act(async () => {
      TestRenderer.create(
        <HomeContainer initialSnapshot={snapshot} onReady={onReady} />,
      );
      await Promise.resolve();
    });
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ protocolVersion: 3 }),
    );
  });

  it('forwards the native settled-tab callback without recreating its contract', async () => {
    const onVisibleTabChange = jest.fn();
    await act(async () => {
      TestRenderer.create(
        <HomeContainer
          initialSnapshot={snapshot}
          onVisibleTabChange={onVisibleTabChange}
        />,
      );
    });

    act(() => {
      mockHostProps?.onVisibleTabChange?.('defi');
    });

    expect(onVisibleTabChange).toHaveBeenCalledWith('defi');
  });

  it('does not rerender an unchanged slot when another slot changes', async () => {
    const balance = {
      content: 'Balance',
      contentRevision: 'balance',
      height: 58,
    };
    const buildSlotBundle = (accountName: string) => ({
      owner: snapshot.identity,
      phase: 'stable' as const,
      semanticRevision: 1,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: {
        accountRow: {
          content: accountName,
          contentRevision: accountName,
          height: 32,
        },
        balance,
      },
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle('Account 1')}
        />,
      );
    });

    await act(async () => {
      renderer.update(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle('Account 2')}
        />,
      );
    });

    expect(mockSlotRenderCounts.get('header.account-row')).toBe(2);
    expect(mockSlotRenderCounts.get('header.balance')).toBe(1);
  });

  it('preserves slot geometry and content while owner interaction is disabled', async () => {
    let contentRenderCount = 0;
    function CountingContent({ label }: { label: string }) {
      contentRenderCount += 1;
      return label;
    }
    const buildSlotBundle = ({
      contentRevision,
      label,
      phase = 'stable',
      storeCommitId,
    }: {
      contentRevision: string;
      label: string;
      phase?: 'owner-transition' | 'stable';
      storeCommitId: number;
    }) => ({
      owner: snapshot.identity,
      phase,
      semanticRevision: storeCommitId,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: {
        balance: {
          authority: {
            owner: snapshot.identity,
            producedByStoreCommitId: storeCommitId,
            slotId: 'header.balance' as const,
            slotRevision: storeCommitId,
          },
          content: <CountingContent label={label} />,
          contentRevision,
          height: 58,
        },
      },
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle({
            contentRevision: 'balance-v1',
            label: 'Balance 1',
            storeCommitId: 1,
          })}
          testID="HomeContainer.Test"
        />,
      );
    });

    await act(async () => {
      renderer.update(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle({
            contentRevision: 'balance-v1',
            label: 'Balance ignored',
            phase: 'owner-transition',
            storeCommitId: 2,
          })}
          testID="HomeContainer.Test"
        />,
      );
    });

    expect(mockSlotRenderCounts.get('')).toBeUndefined();
    expect(mockSlotRenderCounts.get('header.balance')).toBe(2);
    expect(contentRenderCount).toBe(1);
    expect(
      renderer.root
        .findAllByProps({ testID: 'HomeContainer.Test' })
        .some((node) => node.props.pointerEvents === 'none'),
    ).toBe(true);

    await act(async () => {
      renderer.update(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle({
            contentRevision: 'balance-v1',
            label: 'Balance ignored',
            storeCommitId: 3,
          })}
          testID="HomeContainer.Test"
        />,
      );
    });

    expect(mockSlotRenderCounts.get('header.balance')).toBe(3);
    expect(contentRenderCount).toBe(1);
    expect(
      renderer.root
        .findAllByProps({ testID: 'HomeContainer.Test' })
        .some((node) => node.props.pointerEvents === 'auto'),
    ).toBe(true);

    await act(async () => {
      renderer.update(
        <HomeContainer
          initialSnapshot={snapshot}
          slotBundle={buildSlotBundle({
            contentRevision: 'balance-v2',
            label: 'Balance 2',
            storeCommitId: 4,
          })}
          testID="HomeContainer.Test"
        />,
      );
    });

    expect(mockSlotRenderCounts.get('header.balance')).toBe(4);
    expect(contentRenderCount).toBe(2);
  });
});
