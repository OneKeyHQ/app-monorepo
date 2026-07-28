import { getHomeDisplaySnapshotPartitionTag } from '@onekeyhq/kit/src/views/Home/model/cache/homeDisplaySnapshotKeys';
import type { IHomeBodyPresentation } from '@onekeyhq/kit/src/views/Home/model/policies/homeDisplayModelPolicy';
import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  HomeContainerController,
  type IHomeContainerControllerAuthorityStateV3,
  type IHomeContainerHeader,
  type IHomeContainerIntentV3,
  type IHomeContainerOwner,
  type IHomeContainerSection,
  type IHomeContainerSectionId,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlotKey,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
} from '@onekeyhq/native-components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  MOBILE_NATIVE_HOME_STANDARD_ACTION_ROW_HEIGHT,
  buildMobileNativeHomeLoadingSections,
  resolveMobileNativeHomeBodySections,
} from './mobileNativeHomeViewModelAdapter';

const TAB_ORDER: readonly IHomeContainerTabId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
];
const SECTION_IDS: readonly IHomeContainerSectionId[] = [
  ...TAB_ORDER,
  'market',
];

type INativeIntentHandler = (intent: IHomeContainerIntentV3) => boolean;

function createAuthorityState(): IHomeContainerControllerAuthorityStateV3 {
  const sections = Object.fromEntries(
    SECTION_IDS.map((sectionId) => [sectionId, 0]),
  ) as Record<IHomeContainerSectionId, number>;
  return {
    storeCommitId: 0,
    authorityRevisions: {
      shellCommands: 0,
      tabApplicability: 0,
      sectionCommands: { ...sections },
    },
  };
}

function createInitialSnapshot(
  theme: IHomeContainerTheme,
): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 0,
    selectedTabId: 'portfolio',
    header: {
      accountName: '',
      balance: '',
      actionLayout: 'loading',
      actionRowHeight: MOBILE_NATIVE_HOME_STANDARD_ACTION_ROW_HEIGHT,
      actions: [],
      banners: [],
    },
    tabs: [
      {
        id: 'portfolio',
        title: '',
        destination: 'inline',
        sections: [],
      },
    ],
    theme,
  };
}

function mergeSlots(
  contributions: Iterable<IHomeContainerSlots>,
): IHomeContainerSlots {
  const result: IHomeContainerSlots = {
    contentFooters: {},
    contentHeaders: {},
    contentStates: {},
    tabAccessories: {},
  };
  for (const slots of contributions) {
    if (slots.backgroundColor !== undefined) {
      result.backgroundColor = slots.backgroundColor;
    }
    if (slots.accountRow !== undefined) {
      result.accountRow = slots.accountRow;
    }
    if (slots.balance !== undefined) {
      result.balance = slots.balance;
    }
    if (slots.headerActionRow !== undefined) {
      result.headerActionRow = slots.headerActionRow;
    }
    Object.assign(result.contentHeaders!, slots.contentHeaders);
    Object.assign(result.contentStates!, slots.contentStates);
    Object.assign(result.tabAccessories!, slots.tabAccessories);
    Object.entries(slots.contentFooters ?? {}).forEach(
      ([tabId, footerSlots]) => {
        result.contentFooters![tabId as IHomeContainerTabId] = {
          ...result.contentFooters?.[tabId as IHomeContainerTabId],
          ...footerSlots,
        };
      },
    );
  }
  return result;
}

export function isNativeHomeTabId(value: string): value is IHomeContainerTabId {
  return TAB_ORDER.some((tabId) => tabId === value);
}

type IOwnerTransitionFrameScheduler = (flush: () => void) => void;

const scheduleOwnerTransitionFrame: IOwnerTransitionFrameScheduler = (
  flush,
) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => flush());
    return;
  }
  queueMicrotask(flush);
};

export class MobileNativeHomeBridgeRuntime {
  readonly controller: HomeContainerController;

  private authorityState = createAuthorityState();

  private readonly sectionModels = new Map<
    IHomeContainerTabId,
    IHomeContainerSection[]
  >();

  private readonly slotContributions = new Map<string, IHomeContainerSlots>();

  private readonly listeners = new Set<() => void>();

  private readonly intentHandlers = new Map<string, INativeIntentHandler>();

  private slotFlushScheduled = false;

  private slotFlushToken = 0;

  private ownerTransitionSlotFramePending = false;

  private ownerTransitionSlotFrameStartedAt = 0;

  private visibleTabs: readonly IHomeContainerTabId[] = ['portfolio'];

  private destinations: Partial<
    Record<IHomeContainerTabId, 'inline' | 'handoff'>
  > = {};

  private tabTitles: Record<IHomeContainerTabId, string> = {
    portfolio: '',
    perps: '',
    defi: '',
    nft: '',
    history: '',
  };

  private selectedTabId: IHomeContainerTabId = 'portfolio';

  private bodyPresentationKind: IHomeBodyPresentation['kind'] = 'loading';

  private lastNavigation:
    | {
        bodyPresentationKind: IHomeBodyPresentation['kind'];
        selectedTabId: IHomeContainerTabId;
        tabApplicabilityRevision: number;
        tabTitles: Record<IHomeContainerTabId, string>;
        visibleTabs: readonly IHomeContainerTabId[];
        destinations: Partial<
          Record<IHomeContainerTabId, 'inline' | 'handoff'>
        >;
      }
    | undefined;

  private slotBundle: IHomeContainerSlotBundle;

  private disposed = false;

  constructor(
    private owner: IHomeContainerOwner,
    private readonly getStoreCommitId: () => number,
    initialTheme: IHomeContainerTheme,
    private readonly scheduleOwnerFrame: IOwnerTransitionFrameScheduler = scheduleOwnerTransitionFrame,
  ) {
    const initialSlots: IHomeContainerSlots = {};
    this.slotBundle = {
      owner,
      phase: 'stable',
      semanticRevision: 0,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: initialSlots,
    };
    this.controller = new HomeContainerController({
      initialOwner: owner,
      initialProtocolV3AuthorityState: this.authorityState,
      initialSnapshot: createInitialSnapshot(initialTheme),
      onFlushTiming: ({
        kind,
        prepareDurationMs,
        transportDurationMs,
        totalDurationMs,
        updateCount,
      }) => {
        defaultLogger.wallet.homeFramePerf.frame({
          stage: 'functionTiming',
          functionName: `HomeContainerController.flushNow.${kind}`,
          durationMs: totalDurationMs,
          prepareDurationMs,
          transportDurationMs,
          partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
          updateCount,
        });
      },
    });
  }

  readonly subscribeSlots = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSlotBundle = () => this.slotBundle;

  getInitialSnapshot() {
    return this.controller.getInitialProtocolV3Snapshot();
  }

  getSelectedTabId(): IHomeContainerTabId {
    return this.selectedTabId;
  }

  replaceOwner(owner: IHomeContainerOwner, theme: IHomeContainerTheme): void {
    if (
      this.disposed ||
      (this.owner.scopeKey === owner.scopeKey &&
        this.owner.sessionId === owner.sessionId)
    ) {
      return;
    }
    const startedAt = performance.now();
    const previousPartitionTag = getHomeDisplaySnapshotPartitionTag(
      this.owner.scopeKey,
    );
    this.owner = owner;
    this.authorityState = createAuthorityState();
    this.sectionModels.clear();
    this.slotContributions.clear();
    const storeCommitId = this.getStoreCommitId();
    this.slotFlushToken += 1;
    this.slotFlushScheduled = false;
    this.ownerTransitionSlotFramePending = true;
    this.ownerTransitionSlotFrameStartedAt = performance.now();
    this.visibleTabs = ['portfolio'];
    this.destinations = {};
    this.tabTitles = {
      portfolio: '',
      perps: '',
      defi: '',
      nft: '',
      history: '',
    };
    this.selectedTabId = 'portfolio';
    this.bodyPresentationKind = 'loading';
    this.lastNavigation = undefined;
    this.authorityState.storeCommitId = storeCommitId;
    this.slotBundle = {
      owner,
      phase: 'owner-transition',
      semanticRevision: storeCommitId,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: this.slotBundle.slots,
    };
    this.controller.replaceOwner(owner, createInitialSnapshot(theme));
    this.controller.setProtocolV3AuthorityState(this.authorityState);
    defaultLogger.wallet.homeOwnerPerf.transition({
      stage: 'nativeControllerReplaced',
      previousPartitionTag,
      nextPartitionTag: getHomeDisplaySnapshotPartitionTag(owner.scopeKey),
      storeCommitId,
      controllerReused: true,
      elapsedMs: 0,
    });
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'functionTiming',
      functionName: 'MobileNativeHomeBridgeRuntime.replaceOwner',
      durationMs: performance.now() - startedAt,
      partitionTag: getHomeDisplaySnapshotPartitionTag(owner.scopeKey),
      storeCommitId,
    });
    // Producer bridges republish one complete target-owner bundle before the
    // controller's frame flush, avoiding an empty frame between owners.
  }

  authority(
    slotId: IHomeContainerSlotKey,
    slotRevision: number,
    owner: IHomeContainerOwner = this.owner,
  ) {
    return {
      owner,
      producedByStoreCommitId: this.getStoreCommitId(),
      slotId,
      slotRevision,
    };
  }

  storeAuthority(
    slotId: IHomeContainerSlotKey,
    owner: IHomeContainerOwner = this.owner,
  ) {
    const storeCommitId = this.getStoreCommitId();
    return {
      owner,
      producedByStoreCommitId: storeCommitId,
      slotId,
      slotRevision: storeCommitId,
    };
  }

  updateTheme(theme: IHomeContainerTheme): void {
    this.controller.updateTheme(theme);
  }

  updateHeader(input: {
    commandRevision: number;
    header: IHomeContainerHeader;
  }): void {
    const startedAt = performance.now();
    this.authorityState = {
      storeCommitId: this.getStoreCommitId(),
      authorityRevisions: {
        ...this.authorityState.authorityRevisions,
        shellCommands: input.commandRevision,
      },
    };
    this.commitRevisions();
    this.controller.updateHeader(input.header);
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'functionTiming',
      functionName: 'MobileNativeHomeBridgeRuntime.updateHeader',
      durationMs: performance.now() - startedAt,
      partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
      storeCommitId: this.authorityState.storeCommitId,
    });
  }

  updateNavigation(input: {
    bodyPresentationKind: IHomeBodyPresentation['kind'];
    destinations: Partial<Record<IHomeContainerTabId, 'inline' | 'handoff'>>;
    selectedTabId: IHomeContainerTabId;
    tabApplicabilityRevision: number;
    tabTitles: Record<IHomeContainerTabId, string>;
    visibleTabs: readonly IHomeContainerTabId[];
  }): void {
    if (this.isSameNavigation(input)) {
      return;
    }
    const startedAt = performance.now();
    this.lastNavigation = {
      ...input,
      destinations: { ...input.destinations },
      tabTitles: { ...input.tabTitles },
      visibleTabs: [...input.visibleTabs],
    };
    this.visibleTabs = input.visibleTabs;
    this.destinations = input.destinations;
    this.tabTitles = input.tabTitles;
    this.bodyPresentationKind = input.bodyPresentationKind;
    this.selectedTabId = input.selectedTabId;
    this.authorityState = {
      storeCommitId: this.getStoreCommitId(),
      authorityRevisions: {
        ...this.authorityState.authorityRevisions,
        tabApplicability: input.tabApplicabilityRevision,
      },
    };
    this.commitRevisions();
    this.controller.updateTabs(this.buildTabs());
    this.controller.selectTab(this.selectedTabId);
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'functionTiming',
      functionName: 'MobileNativeHomeBridgeRuntime.updateNavigation',
      durationMs: performance.now() - startedAt,
      partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
      inputCount: input.visibleTabs.length,
      storeCommitId: this.authorityState.storeCommitId,
    });
  }

  updateSection(input: {
    commandRevision: number;
    sectionId: IHomeContainerSectionId;
    sections: IHomeContainerSection[];
  }): void {
    const startedAt = performance.now();
    this.authorityState = {
      storeCommitId: this.getStoreCommitId(),
      authorityRevisions: {
        ...this.authorityState.authorityRevisions,
        sectionCommands: {
          ...this.authorityState.authorityRevisions.sectionCommands,
          [input.sectionId]: input.commandRevision,
        },
      },
    };
    this.commitRevisions();
    if (!isNativeHomeTabId(input.sectionId)) {
      defaultLogger.wallet.homeFramePerf.frame({
        stage: 'functionTiming',
        functionName: 'MobileNativeHomeBridgeRuntime.updateSection',
        durationMs: performance.now() - startedAt,
        partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
        sectionId: input.sectionId,
        outcome: 'nonNativeSection',
        outputSectionCount: input.sections.length,
        outputItemCount: input.sections.reduce(
          (total, section) => total + section.items.length,
          0,
        ),
      });
      return;
    }
    this.sectionModels.set(input.sectionId, input.sections);
    if (
      this.visibleTabs.includes(input.sectionId) &&
      this.destinations[input.sectionId] !== 'handoff'
    ) {
      this.controller.updateTabSections(
        input.sectionId,
        resolveMobileNativeHomeBodySections({
          bodyPresentationKind: this.bodyPresentationKind,
          sections: input.sections,
          tabId: input.sectionId,
        }),
        input.sectionId,
      );
    }
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'functionTiming',
      functionName: 'MobileNativeHomeBridgeRuntime.updateSection',
      durationMs: performance.now() - startedAt,
      partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
      sectionId: input.sectionId,
      outcome: this.visibleTabs.includes(input.sectionId)
        ? 'visible'
        : 'notVisible',
      outputSectionCount: input.sections.length,
      outputItemCount: input.sections.reduce(
        (total, section) => total + section.items.length,
        0,
      ),
      storeCommitId: this.authorityState.storeCommitId,
    });
  }

  updateSlots(bridgeId: string, slots: IHomeContainerSlots): void {
    if (this.disposed || this.slotContributions.get(bridgeId) === slots) {
      return;
    }
    this.slotContributions.set(bridgeId, slots);
    if (this.slotFlushScheduled) {
      return;
    }
    this.slotFlushScheduled = true;
    this.slotFlushToken += 1;
    const flushToken = this.slotFlushToken;
    const flush = () => {
      if (flushToken !== this.slotFlushToken) {
        return;
      }
      this.slotFlushScheduled = false;
      if (this.disposed) {
        return;
      }
      const wasOwnerTransitionFrame = this.ownerTransitionSlotFramePending;
      this.ownerTransitionSlotFramePending = false;
      this.flushSlots();
      if (wasOwnerTransitionFrame) {
        defaultLogger.wallet.homeFramePerf.frame({
          stage: 'functionTiming',
          functionName:
            'MobileNativeHomeBridgeRuntime.ownerTransitionSlotFrame',
          durationMs:
            performance.now() - this.ownerTransitionSlotFrameStartedAt,
          outcome: 'committed',
          contributionCount: this.slotContributions.size,
          partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
          storeCommitId: this.authorityState.storeCommitId,
        });
      }
    };
    if (this.ownerTransitionSlotFramePending) {
      this.scheduleOwnerFrame(flush);
      return;
    }
    queueMicrotask(flush);
  }

  private flushSlots(): void {
    const startedAt = performance.now();
    const merged = mergeSlots(this.slotContributions.values());
    this.authorityState = {
      ...this.authorityState,
      storeCommitId: this.getStoreCommitId(),
    };
    this.commitRevisions();
    this.slotBundle = {
      owner: this.owner,
      phase: 'stable',
      semanticRevision: this.authorityState.storeCommitId,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: merged,
    };
    this.listeners.forEach((listener) => listener());
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'functionTiming',
      functionName: 'MobileNativeHomeBridgeRuntime.flushSlots',
      durationMs: performance.now() - startedAt,
      partitionTag: getHomeDisplaySnapshotPartitionTag(this.owner.scopeKey),
      contributionCount: this.slotContributions.size,
      listenerCount: this.listeners.size,
      storeCommitId: this.authorityState.storeCommitId,
    });
  }

  registerIntentHandler(
    handlerId: string,
    handler: INativeIntentHandler,
  ): () => void {
    this.intentHandlers.set(handlerId, handler);
    return () => {
      if (this.intentHandlers.get(handlerId) === handler) {
        this.intentHandlers.delete(handlerId);
      }
    };
  }

  handleSpecialIntent(intent: IHomeContainerIntentV3): boolean {
    for (const handler of this.intentHandlers.values()) {
      if (handler(intent)) {
        return true;
      }
    }
    return false;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.intentHandlers.clear();
    this.listeners.clear();
    this.controller.dispose();
  }

  private commitRevisions(): void {
    this.controller.setProtocolV3AuthorityState(this.authorityState);
  }

  private isSameNavigation(input: {
    bodyPresentationKind: IHomeBodyPresentation['kind'];
    destinations: Partial<Record<IHomeContainerTabId, 'inline' | 'handoff'>>;
    selectedTabId: IHomeContainerTabId;
    tabApplicabilityRevision: number;
    tabTitles: Record<IHomeContainerTabId, string>;
    visibleTabs: readonly IHomeContainerTabId[];
  }): boolean {
    const previous = this.lastNavigation;
    return Boolean(
      previous &&
      previous.bodyPresentationKind === input.bodyPresentationKind &&
      previous.selectedTabId === input.selectedTabId &&
      previous.tabApplicabilityRevision === input.tabApplicabilityRevision &&
      TAB_ORDER.every(
        (tabId, index) =>
          previous.visibleTabs[index] === input.visibleTabs[index] &&
          previous.tabTitles[tabId] === input.tabTitles[tabId] &&
          previous.destinations[tabId] === input.destinations[tabId],
      ) &&
      previous.visibleTabs.length === input.visibleTabs.length,
    );
  }

  private buildTabs(): IHomeContainerTab[] {
    const tabs = TAB_ORDER.filter((tabId) =>
      this.visibleTabs.includes(tabId),
    ).map<IHomeContainerTab>((tabId) => {
      if (this.destinations[tabId] === 'handoff') {
        return {
          id: tabId,
          title: this.tabTitles[tabId],
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        };
      }
      return {
        id: tabId,
        title: this.tabTitles[tabId],
        destination: 'inline',
        sections: resolveMobileNativeHomeBodySections({
          bodyPresentationKind: this.bodyPresentationKind,
          sections:
            this.sectionModels.get(tabId) ??
            buildMobileNativeHomeLoadingSections(tabId),
          tabId,
        }),
      };
    });
    return tabs.length
      ? tabs
      : [
          {
            id: 'portfolio',
            title: this.tabTitles.portfolio,
            destination: 'inline',
            sections: [],
          },
        ];
  }
}
