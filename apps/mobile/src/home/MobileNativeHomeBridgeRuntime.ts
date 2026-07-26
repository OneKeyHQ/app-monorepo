import type { IHomeBodyPresentation } from '@onekeyhq/kit/src/views/Home/model/policies/homeDisplayModelPolicy';
import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  HomeContainerController,
  type IHomeContainerControllerRevisionStateV3,
  type IHomeContainerHeader,
  type IHomeContainerIntentV3,
  type IHomeContainerOwner,
  type IHomeContainerSection,
  type IHomeContainerSectionId,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlotKey,
  type IHomeContainerSlots,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
} from '@onekeyhq/native-components';

import { resolveMobileNativeHomeBodySections } from './mobileNativeHomeViewModelAdapter';

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

function createRevisionState(): IHomeContainerControllerRevisionStateV3 {
  const sections = Object.fromEntries(
    SECTION_IDS.map((sectionId) => [sectionId, 0]),
  ) as Record<IHomeContainerSectionId, number>;
  return {
    storeCommitId: 0,
    presentationRevisions: {
      shell: 0,
      navigation: 0,
      sections: { ...sections },
    },
    authorityRevisions: {
      shellCommands: 0,
      tabApplicability: 0,
      sectionCommands: { ...sections },
    },
    slotRevisions: {},
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

function collectSlotRevisions(
  slots: IHomeContainerSlots,
): Record<string, number> {
  const revisions: Record<string, number> = {};
  const add = (
    slot: { authority?: { slotId: string; slotRevision: number } } | undefined,
  ) => {
    if (slot?.authority) {
      revisions[slot.authority.slotId] = slot.authority.slotRevision;
    }
  };
  add(slots.accountRow);
  add(slots.balance);
  add(slots.headerActionRow);
  Object.values(slots.contentHeaders ?? {}).forEach(add);
  Object.values(slots.contentStates ?? {}).forEach(add);
  Object.values(slots.tabAccessories ?? {}).forEach(add);
  Object.values(slots.contentFooters ?? {}).forEach((footers) => {
    Object.values(footers ?? {}).forEach(add);
  });
  return revisions;
}

export function isNativeHomeTabId(value: string): value is IHomeContainerTabId {
  return TAB_ORDER.some((tabId) => tabId === value);
}

export class MobileNativeHomeBridgeRuntime {
  readonly controller: HomeContainerController;

  private revisionState = createRevisionState();

  private readonly sectionModels = new Map<
    IHomeContainerTabId,
    IHomeContainerSection[]
  >();

  private readonly slotContributions = new Map<string, IHomeContainerSlots>();

  private readonly listeners = new Set<() => void>();

  private readonly intentHandlers = new Map<string, INativeIntentHandler>();

  private slotFlushScheduled = false;

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
        presentationRevision: number;
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
    readonly owner: IHomeContainerOwner,
    private readonly getStoreCommitId: () => number,
    initialTheme: IHomeContainerTheme,
  ) {
    const initialSlots: IHomeContainerSlots = {};
    this.slotBundle = {
      owner,
      semanticRevision: 0,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: initialSlots,
    };
    this.controller = new HomeContainerController({
      initialOwner: owner,
      initialProtocolV3Revisions: this.revisionState,
      initialSlots,
      initialSnapshot: {
        schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
        revision: 0,
        selectedTabId: 'portfolio',
        header: {
          accountName: '',
          balance: '',
          actionLayout: 'loading',
          actionRowHeight: 98,
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
        theme: initialTheme,
      },
      requireProtocolV3: true,
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

  authority(slotId: IHomeContainerSlotKey, slotRevision: number) {
    return {
      owner: this.owner,
      producedByStoreCommitId: this.getStoreCommitId(),
      slotId,
      slotRevision,
    };
  }

  updateTheme(theme: IHomeContainerTheme): void {
    this.controller.updateTheme(theme);
  }

  updateHeader(input: {
    commandRevision: number;
    header: IHomeContainerHeader;
    presentationRevision: number;
  }): void {
    this.revisionState.storeCommitId = this.getStoreCommitId();
    this.revisionState.presentationRevisions.shell = input.presentationRevision;
    this.revisionState.authorityRevisions.shellCommands = input.commandRevision;
    this.commitRevisions();
    this.controller.updateHeader(input.header);
  }

  updateNavigation(input: {
    bodyPresentationKind: IHomeBodyPresentation['kind'];
    destinations: Partial<Record<IHomeContainerTabId, 'inline' | 'handoff'>>;
    presentationRevision: number;
    selectedTabId: IHomeContainerTabId;
    tabApplicabilityRevision: number;
    tabTitles: Record<IHomeContainerTabId, string>;
    visibleTabs: readonly IHomeContainerTabId[];
  }): void {
    if (this.isSameNavigation(input)) {
      return;
    }
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
    this.revisionState.storeCommitId = this.getStoreCommitId();
    this.revisionState.presentationRevisions.navigation =
      input.presentationRevision;
    this.revisionState.authorityRevisions.tabApplicability =
      input.tabApplicabilityRevision;
    this.commitRevisions();
    this.controller.updateTabs(this.buildTabs());
    this.controller.selectTab(this.selectedTabId);
  }

  updateSection(input: {
    commandRevision: number;
    presentationRevision: number;
    sectionId: IHomeContainerSectionId;
    sections: IHomeContainerSection[];
  }): void {
    this.revisionState.storeCommitId = this.getStoreCommitId();
    this.revisionState = {
      ...this.revisionState,
      presentationRevisions: {
        ...this.revisionState.presentationRevisions,
        sections: {
          ...this.revisionState.presentationRevisions.sections,
          [input.sectionId]: input.presentationRevision,
        },
      },
      authorityRevisions: {
        ...this.revisionState.authorityRevisions,
        sectionCommands: {
          ...this.revisionState.authorityRevisions.sectionCommands,
          [input.sectionId]: input.commandRevision,
        },
      },
    };
    this.commitRevisions();
    if (!isNativeHomeTabId(input.sectionId)) {
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
      );
    }
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
    queueMicrotask(() => {
      this.slotFlushScheduled = false;
      if (this.disposed) {
        return;
      }
      this.flushSlots();
    });
  }

  private flushSlots(): void {
    const merged = mergeSlots(this.slotContributions.values());
    this.revisionState.storeCommitId = this.getStoreCommitId();
    this.revisionState.slotRevisions = collectSlotRevisions(merged);
    this.commitRevisions();
    this.controller.updateSlots(merged);
    this.slotBundle = {
      owner: this.owner,
      semanticRevision: this.revisionState.storeCommitId,
      slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
      slots: merged,
    };
    this.listeners.forEach((listener) => listener());
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
    this.controller.setProtocolV3RevisionState(this.revisionState);
  }

  private isSameNavigation(input: {
    bodyPresentationKind: IHomeBodyPresentation['kind'];
    destinations: Partial<Record<IHomeContainerTabId, 'inline' | 'handoff'>>;
    presentationRevision: number;
    selectedTabId: IHomeContainerTabId;
    tabApplicabilityRevision: number;
    tabTitles: Record<IHomeContainerTabId, string>;
    visibleTabs: readonly IHomeContainerTabId[];
  }): boolean {
    const previous = this.lastNavigation;
    return Boolean(
      previous &&
      previous.bodyPresentationKind === input.bodyPresentationKind &&
      previous.presentationRevision === input.presentationRevision &&
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
          sections: this.sectionModels.get(tabId) ?? [],
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
