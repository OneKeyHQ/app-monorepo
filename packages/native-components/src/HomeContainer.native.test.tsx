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
import { HomeContainerController } from './HomeContainerController';
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
      protocolVersions: [1, HOME_CONTAINER_PROTOCOL_VERSION],
      preferredProtocol: HOME_CONTAINER_PROTOCOL_VERSION,
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
      onTransportResult?: (resultJson: string) => void;
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

function buildSnapshot(owner: IHomeContainerOwner, revision: number) {
  const envelope = buildEnvelope(owner, revision);
  return {
    ...envelope.payload,
    schemaVersion: envelope.schemaVersion,
    revision: envelope.revision,
  };
}

function buildBundle(
  owner: IHomeContainerOwner,
  revision: number,
  slots: IHomeContainerSlots,
): IHomeContainerSlotBundle {
  return {
    owner,
    semanticRevision: revision,
    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
    slots,
  };
}

function buildProtocolV3Snapshot(
  owner: IHomeContainerOwner,
  transportRevision: number,
  storeCommitId: number,
  slotRevisions: Readonly<Record<string, number>>,
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

describe('Native HomeContainer protocol v2 slot fallback', () => {
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

  it('submits the initial snapshot and slots with the first native mount', () => {
    const initialSlots: IHomeContainerSlots = {
      balance: {
        content: 'initial-balance',
      },
    };
    const snapshot = buildSnapshot(ownerA, 0);
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          snapshot={snapshot}
          slotBundle={buildBundle(ownerA, 0, initialSlots)}
        />,
      );
    });

    expect(JSON.parse(mockHostProps?.initialSnapshotJson ?? '')).toEqual(
      snapshot,
    );
    expect(rendererHasText(view, 'initial-balance')).toBe(true);
    act(() => view.unmount());
  });

  it('keeps the first submitted loading slots visible across an unacknowledged full resync', () => {
    const ref = createRef<IHomeContainerRef>();
    const loadingSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'loading-skeleton', height: 320 },
      },
    };
    const terminalSlots: IHomeContainerSlots = {
      contentHeaders: {
        portfolio: { content: 'Tokens', height: 56 },
      },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          onTransportResult={jest.fn()}
          slotBundle={buildBundle(ownerA, -1, loadingSlots)}
        />,
      );
    });

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerA, 5),
        loadingSlots,
      );
    });
    expect(rendererHasText(view, 'loading-skeleton')).toBe(true);

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerA, 6),
        terminalSlots,
      );
      view.update(
        <HomeContainer
          ref={ref}
          onTransportResult={jest.fn()}
          slotBundle={buildBundle(ownerA, 6, terminalSlots)}
        />,
      );
    });

    expect(rendererHasText(view, 'loading-skeleton')).toBe(true);
    expect(rendererHasText(view, 'Tokens')).toBe(false);

    act(() => {
      mockHostProps?.onTransportResult?.(
        JSON.stringify({ kind: 'applied', owner: ownerA, revision: 6 }),
      );
    });
    expect(rendererHasText(view, 'Tokens')).toBe(true);
    expect(rendererHasText(view, 'loading-skeleton')).toBe(false);
    act(() => view.unmount());
  });

  it('clears the old-owner fallback before a replacement owner is acknowledged', () => {
    const ref = createRef<IHomeContainerRef>();
    const oldOwnerSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'old-owner-loading', height: 320 },
      },
    };
    const newOwnerSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'new-owner-loading', height: 320 },
      },
    };
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          onTransportResult={jest.fn()}
          slotBundle={buildBundle(ownerA, -1, oldOwnerSlots)}
        />,
      );
    });
    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerA, 5),
        oldOwnerSlots,
      );
    });
    expect(rendererHasText(view, 'old-owner-loading')).toBe(true);

    act(() => {
      view.update(
        <HomeContainer
          ref={ref}
          onTransportResult={jest.fn()}
          slotBundle={buildBundle(ownerB, -1, newOwnerSlots)}
        />,
      );
    });
    expect(rendererHasText(view, 'old-owner-loading')).toBe(false);
    expect(rendererHasText(view, 'new-owner-loading')).toBe(false);

    act(() => {
      ref.current?.setProtocolV2Snapshot?.(
        buildEnvelope(ownerB, 6),
        newOwnerSlots,
      );
    });
    expect(rendererHasText(view, 'new-owner-loading')).toBe(true);
    expect(rendererHasText(view, 'old-owner-loading')).toBe(false);
    act(() => view.unmount());
  });

  it('shows the submitted replacement owner when the parent bundle has not rerendered', () => {
    const ref = createRef<IHomeContainerRef>();
    const oldOwnerSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'old-owner-loading', height: 320 },
      },
    };
    const newOwnerSlots: IHomeContainerSlots = {
      contentStates: {
        portfolio: { content: 'new-owner-loading', height: 320 },
      },
    };
    const deadlines: Array<{
      callback: () => void;
      cancelled: boolean;
    }> = [];
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(ownerA, 0),
      initialSlots: oldOwnerSlots,
      schedule: () => undefined,
      scheduleDeadline: (callback) => {
        const deadline = { callback, cancelled: false };
        deadlines.push(deadline);
        return () => {
          deadline.cancelled = true;
        };
      },
    });
    const handleTransportResult = jest.fn((resultJson: string) => {
      controller.handleTransportResult(resultJson);
    });
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(
        <HomeContainer
          ref={ref}
          onTransportResult={handleTransportResult}
          slotBundle={buildBundle(ownerA, -1, oldOwnerSlots)}
        />,
      );
    });
    act(() => {
      controller.attach(ref.current!);
    });
    expect(rendererHasText(view, 'old-owner-loading')).toBe(true);

    act(() => {
      controller.replaceOwner(ownerB, buildSnapshot(ownerB, 0));
      controller.updateSlots(newOwnerSlots);
      controller.flushNow();
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const deadline = deadlines
        .toReversed()
        .find((candidate) => !candidate.cancelled);
      expect(deadline).toBeDefined();
      act(() => {
        deadline!.cancelled = true;
        deadline!.callback();
        controller.flushNow();
      });
    }

    expect(rendererHasText(view, 'new-owner-loading')).toBe(true);
    expect(rendererHasText(view, 'old-owner-loading')).toBe(false);

    const snapshotCalls = mockNativeView.setSnapshot.mock.calls;
    const recoveryEnvelope = JSON.parse(
      snapshotCalls[snapshotCalls.length - 1][0] as string,
    ) as IHomeContainerSnapshotEnvelope;
    expect(recoveryEnvelope.owner).toEqual(ownerB);
    act(() => {
      mockHostProps?.onTransportResult?.(
        JSON.stringify({
          kind: 'applied',
          owner: recoveryEnvelope.owner,
          revision: recoveryEnvelope.revision,
        }),
      );
    });
    expect(controller.getRenderedSlotState()?.owner).toEqual(ownerB);

    act(() => {
      view.update(
        <HomeContainer
          ref={ref}
          onTransportResult={handleTransportResult}
          slotBundle={buildBundle(
            ownerB,
            recoveryEnvelope.revision,
            newOwnerSlots,
          )}
        />,
      );
    });
    expect(rendererHasText(view, 'new-owner-loading')).toBe(true);
    expect(rendererHasText(view, 'old-owner-loading')).toBe(false);
    act(() => view.unmount());
    controller.dispose();
  });

  it('publishes same-owner v3 slot metadata before submitting the native patch', () => {
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
          onTransportResult={jest.fn()}
          slotBundle={buildBundle(ownerA, 11, initialSlots)}
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
      mockHostProps?.onTransportResult?.(
        JSON.stringify({ kind: 'applied', owner: ownerA, revision: 11 }),
      );
    });

    mockNativeView.applyPatch.mockClear();
    act(() => {
      ref.current?.applyProtocolV3Patch?.(patch, nextSlots);
    });

    const balanceSlot = view.root.findByProps({
      testID: 'HomeContainer.Slot.header.balance',
    });
    expect(balanceSlot.props).toMatchObject({
      ownerScopeKey: ownerA.scopeKey,
      ownerSessionId: ownerA.sessionId,
      producedByStoreCommitId: 8,
      slotRevision: 5,
    });
    expect(rendererHasText(view, 'balance-revision-5')).toBe(true);
    expect(mockNativeView.applyPatch).toHaveBeenCalledTimes(1);
    expect(mockProtocolV3PatchSlotPropsAtSubmission).toMatchObject({
      ownerScopeKey: ownerA.scopeKey,
      ownerSessionId: ownerA.sessionId,
      producedByStoreCommitId: 8,
      slotRevision: 5,
    });
    expect(
      JSON.parse(mockNativeView.applyPatch.mock.calls[0][0] as string),
    ).toMatchObject({
      kind: 'patch',
      requiredSlotRevisions: { 'header.balance': 5 },
      transportRevision: 12,
    });
    act(() => view.unmount());
  });
});
