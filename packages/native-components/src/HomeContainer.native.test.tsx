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
  applyPatch: jest.fn(),
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
  setSnapshot: jest.fn(),
};

let mockHostProps:
  | {
      hybridRef?: (view: typeof mockNativeView) => void;
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
    mockHostProps = undefined;
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
});
