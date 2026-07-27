import { type ReactNode, createRef } from 'react';

import TestRenderer, { act } from 'react-test-renderer';

import { HomeContainer } from './HomeContainer.native';
import {
  HOME_CONTAINER_PROTOCOL_VERSION,
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlots,
  type IHomeContainerSnapshotEnvelope,
} from './HomeContainer.types';
import {
  HOME_CONTAINER_PROTOCOL_V3_VERSION,
  type IHomeContainerPatchEnvelopeV3,
  type IHomeContainerSnapshotEnvelopeV3,
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

const mockSlotPropsByTestId = new Map<string, Record<string, unknown>>();
let mockProtocolV3SnapshotSlotPropsAtSubmission:
  | Record<string, unknown>
  | undefined;
let mockProtocolV3PatchSlotPropsAtSubmission:
  | Record<string, unknown>
  | undefined;

const mockNativeView = {
  applyPatch: jest.fn((json: string) => {
    const payload = JSON.parse(json) as { protocolVersion?: number };
    if (payload.protocolVersion === HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      mockProtocolV3PatchSlotPropsAtSubmission = mockSlotPropsByTestId.get(
        'HomeContainer.Slot.header.balance',
      );
    }
  }),
  completeRefresh: jest.fn(),
  getCapabilities: jest.fn(() =>
    JSON.stringify({
      schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
      protocolVersions: [1, HOME_CONTAINER_PROTOCOL_VERSION, 3],
      preferredProtocol: 3,
      tabIds: ['portfolio'],
      supportsPatches: true,
      supportsAtomicPatches: true,
      supportsNativeRefresh: true,
      supportsHorizontalPaging: true,
      supportsSlots: true,
    }),
  ),
  selectTab: jest.fn(),
  setSnapshot: jest.fn((json: string) => {
    const payload = JSON.parse(json) as { protocolVersion?: number };
    if (payload.protocolVersion === HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      mockProtocolV3SnapshotSlotPropsAtSubmission = mockSlotPropsByTestId.get(
        'HomeContainer.Slot.header.balance',
      );
    }
  }),
};

let mockHostProps:
  | {
      hybridRef?: (view: typeof mockNativeView) => void;
      initialSnapshotJson?: string;
      onSnapshotRequired?: (requestJson: string) => void;
    }
  | undefined;

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    hasHybridObject: jest.fn(() => true),
  },
  callback: jest.fn((callbackValue: unknown) => callbackValue),
  getHostComponent: jest.fn(
    () =>
      function MockHomeContainerHost(props: NonNullable<typeof mockHostProps>) {
        const React = jest.requireActual<typeof import('react')>('react');
        mockHostProps = props;
        const { hybridRef } = props;
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
  default: ({ children, ...props }: { children?: ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const testID = (props as { testID?: string }).testID;
    if (testID) {
      mockSlotPropsByTestId.set(testID, props);
    }
    return React.createElement('View', props, children);
  },
}));

jest.mock('./HomeContainerSurfaceNativeComponent', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children?: ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('View', props, children);
  },
}));

const ownerA: IHomeContainerOwner = {
  scopeKey: 'bitcoin',
  sessionId: 'session-a',
};

const ownerB: IHomeContainerOwner = {
  scopeKey: 'ethereum',
  sessionId: 'session-b',
};

const ownerC: IHomeContainerOwner = {
  scopeKey: 'solana',
  sessionId: 'session-c',
};

function buildEnvelope(
  owner: IHomeContainerOwner,
  revision: number,
): IHomeContainerSnapshotEnvelope {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_VERSION,
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    owner,
    revision,
    payload: {
      selectedTabId: 'portfolio',
      header: {
        accountName: 'Account',
        balance: '',
        actions: [],
        banners: [],
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          destination: 'inline',
          sections: [],
        },
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
    },
  };
}

function buildBundle(
  owner: IHomeContainerOwner,
  semanticRevision: number,
  slots: IHomeContainerSlots,
): IHomeContainerSlotBundle {
  return {
    owner,
    semanticRevision,
    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
    slots,
  };
}

function buildProtocolV3Snapshot(
  owner: IHomeContainerOwner,
  transportRevision: number,
  storeCommitId: number,
  slotRevisions: Readonly<Record<string, number>> = {},
): IHomeContainerSnapshotEnvelopeV3 {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
    identity: { ...owner, storeCommitId },
    transportRevision,
    presentationRevisions: {
      shell: 1,
      navigation: 1,
      sections: {
        portfolio: 1,
        perps: 1,
        defi: 1,
        nft: 1,
        history: 1,
        market: 1,
      },
    },
    authorityRevisions: {
      shellCommands: 1,
      tabApplicability: 1,
      sectionCommands: {
        portfolio: 1,
        perps: 1,
        defi: 1,
        nft: 1,
        history: 1,
        market: 1,
      },
    },
    slotRevisions,
    payload: buildEnvelope(owner, transportRevision).payload,
  };
}

function rendererHasText(view: TestRenderer.ReactTestRenderer, text: string) {
  return view.root.findAll((node) => node.children.includes(text)).length > 0;
}

describe('Native HomeContainer slot transport', () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSlotPropsByTestId.clear();
    mockProtocolV3SnapshotSlotPropsAtSubmission = undefined;
    mockProtocolV3PatchSlotPropsAtSubmission = undefined;
    mockHostProps = undefined;
  });

  it('submits one protocol v3 snapshot with the first native mount', () => {
    const slots: IHomeContainerSlots = {
      balance: { content: 'initial-balance' },
    };
    const initialSnapshot = buildProtocolV3Snapshot(ownerA, 1, 1);
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          initialSnapshot={initialSnapshot}
          slotBundle={buildBundle(ownerA, 1, slots)}
        />,
      );
    });

    expect(JSON.parse(mockHostProps?.initialSnapshotJson ?? '')).toEqual(
      initialSnapshot,
    );
    expect(rendererHasText(view, 'initial-balance')).toBe(true);

    act(() => {
      view.update(
        <HomeContainer
          initialSnapshot={buildProtocolV3Snapshot(ownerA, 2, 2)}
          slotBundle={buildBundle(ownerA, 2, slots)}
        />,
      );
    });

    expect(JSON.parse(mockHostProps?.initialSnapshotJson ?? '')).toEqual(
      initialSnapshot,
    );
    expect(mockNativeView.setSnapshot).not.toHaveBeenCalled();
    act(() => view.unmount());
  });

  it('exposes protocol v2 slots as soon as they are submitted', () => {
    const ref = createRef<IHomeContainerRef>();
    const firstSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'loading-skeleton', height: 320 },
      },
    };
    const nextSlots: IHomeContainerSlots = {
      contentHeaders: {
        portfolio: { content: 'Tokens', height: 56 },
      },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(<HomeContainer ref={ref} />);
    });

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerA, 5),
        firstSlots,
      );
    });
    expect(rendererHasText(view, 'loading-skeleton')).toBe(true);

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(buildEnvelope(ownerA, 6), nextSlots);
    });
    expect(rendererHasText(view, 'Tokens')).toBe(true);
    expect(rendererHasText(view, 'loading-skeleton')).toBe(false);
    expect(mockNativeView.setSnapshot).toHaveBeenCalledTimes(2);
    act(() => view.unmount());
  });

  it('does not retain an older staged owner after the parent owner changes', () => {
    const ref = createRef<IHomeContainerRef>();
    const oldSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'old-owner', height: 320 },
      },
    };
    const newSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'new-owner', height: 320 },
      },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          slotBundle={buildBundle(ownerA, 5, oldSlots)}
        />,
      );
    });
    act(() => {
      ref.current?.setProtocolV2Snapshot?.(buildEnvelope(ownerA, 6), oldSlots);
    });

    act(() => {
      view.update(
        <HomeContainer
          ref={ref}
          slotBundle={buildBundle(ownerB, 1, newSlots)}
        />,
      );
    });

    expect(rendererHasText(view, 'new-owner')).toBe(true);
    expect(rendererHasText(view, 'old-owner')).toBe(false);
    act(() => view.unmount());
  });

  it('shows a submitted replacement owner before its parent bundle rerenders', () => {
    const ref = createRef<IHomeContainerRef>();
    const oldSlots: IHomeContainerSlots = {
      balance: { content: 'owner-a-balance' },
    };
    const replacementSlots: IHomeContainerSlots = {
      balance: { content: 'owner-c-balance' },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          slotBundle={buildBundle(ownerA, 5, oldSlots)}
        />,
      );
    });

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerC, 1),
        replacementSlots,
      );
    });

    expect(rendererHasText(view, 'owner-c-balance')).toBe(true);
    expect(rendererHasText(view, 'owner-a-balance')).toBe(false);
    act(() => view.unmount());
  });

  it('publishes v3 slot metadata before submitting the native patch', () => {
    const ref = createRef<IHomeContainerRef>();
    const initialSlots: IHomeContainerSlots = {
      balance: {
        content: 'balance-revision-4',
        authority: {
          owner: ownerA,
          producedByStoreCommitId: 7,
          slotId: 'header.balance',
          slotRevision: 4,
        },
      },
    };
    const nextSlots: IHomeContainerSlots = {
      balance: {
        content: 'balance-revision-5',
        authority: {
          owner: ownerA,
          producedByStoreCommitId: 8,
          slotId: 'header.balance',
          slotRevision: 5,
        },
      },
    };
    const snapshot = buildProtocolV3Snapshot(ownerA, 11, 7, {
      'header.balance': 4,
    });
    const patch: IHomeContainerPatchEnvelopeV3 = {
      kind: 'patch',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: { ...ownerA, storeCommitId: 8 },
      baseTransportRevision: 11,
      transportRevision: 12,
      presentationRevisions: snapshot.presentationRevisions,
      authorityRevisions: snapshot.authorityRevisions,
      requiredSlotRevisions: { 'header.balance': 5 },
      changes: [],
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          slotBundle={buildBundle(ownerA, 7, initialSlots)}
        />,
      );
    });

    act(() => {
      ref.current?.setProtocolV3Snapshot?.(snapshot, initialSlots);
    });
    expect(mockProtocolV3SnapshotSlotPropsAtSubmission).toMatchObject({
      ownerScopeKey: ownerA.scopeKey,
      ownerSessionId: ownerA.sessionId,
      producedByStoreCommitId: 7,
      slotRevision: 4,
    });

    act(() => {
      ref.current?.applyProtocolV3Patch?.(patch, nextSlots);
    });

    expect(rendererHasText(view, 'balance-revision-5')).toBe(true);
    expect(mockNativeView.applyPatch).toHaveBeenCalledTimes(1);
    expect(mockProtocolV3PatchSlotPropsAtSubmission).toMatchObject({
      ownerScopeKey: ownerA.scopeKey,
      ownerSessionId: ownerA.sessionId,
      producedByStoreCommitId: 8,
      slotRevision: 5,
    });
    act(() => view.unmount());
  });

  it('compares staged and parent slots in the Store commit domain', () => {
    const ref = createRef<IHomeContainerRef>();
    const parentSlots: IHomeContainerSlots = {
      balance: {
        content: 'parent-store-commit-9',
        authority: {
          owner: ownerA,
          producedByStoreCommitId: 9,
          slotId: 'header.balance',
          slotRevision: 9,
        },
      },
    };
    const staleTransportSlots: IHomeContainerSlots = {
      balance: {
        content: 'stale-store-commit-7',
        authority: {
          owner: ownerA,
          producedByStoreCommitId: 7,
          slotId: 'header.balance',
          slotRevision: 7,
        },
      },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          slotBundle={buildBundle(ownerA, 9, parentSlots)}
        />,
      );
    });

    act(() => {
      ref.current?.setProtocolV3Snapshot?.(
        buildProtocolV3Snapshot(ownerA, 100, 7, {
          'header.balance': 7,
        }),
        staleTransportSlots,
      );
    });

    expect(rendererHasText(view, 'parent-store-commit-9')).toBe(true);
    expect(rendererHasText(view, 'stale-store-commit-7')).toBe(false);
    act(() => view.unmount());
  });

  it('forwards only the explicit snapshot-required signal', () => {
    const onSnapshotRequired = jest.fn();
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer onSnapshotRequired={onSnapshotRequired} />,
      );
    });
    const request = JSON.stringify({
      kind: 'needSnapshot',
      owner: ownerA,
      reason: 'revisionGap',
    });

    act(() => {
      mockHostProps?.onSnapshotRequired?.(request);
    });

    expect(onSnapshotRequired).toHaveBeenCalledWith(request);
    act(() => view.unmount());
  });
});
