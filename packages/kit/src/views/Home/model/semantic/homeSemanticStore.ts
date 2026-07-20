import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeAuthoritativeNavigationSnapshot,
  IHomeAuthoritativeSectionSnapshot,
  IHomeAuthoritativeShellSnapshot,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeSemanticModel,
  IHomeSemanticStoreSnapshot,
  IVersionedHomeSemanticSlice,
} from './homeSemanticTypes';

const sectionIds: readonly IHomeSectionId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
];

function areEqual(first: unknown, second: unknown): boolean {
  return (
    stringUtils.stableStringify(first) === stringUtils.stableStringify(second)
  );
}

function versioned<T>(
  revision: number,
  value: T,
): IVersionedHomeSemanticSlice<T> {
  return { revision, value };
}

function advanceHomeAuthoritativeShellSnapshot(
  current: IHomeAuthoritativeShellSnapshot | undefined,
  candidate: IHomeAuthoritativeShellSnapshot,
): IHomeAuthoritativeShellSnapshot {
  const sameOwner =
    current?.owner.scopeKey === candidate.owner.scopeKey &&
    current.owner.sessionId === candidate.owner.sessionId;
  return {
    ...candidate,
    revision: sameOwner ? current.revision + 1 : 1,
  };
}

function advanceHomeAuthoritativeNavigationSnapshot(
  current: IHomeAuthoritativeNavigationSnapshot | undefined,
  candidate: IHomeAuthoritativeNavigationSnapshot,
): IHomeAuthoritativeNavigationSnapshot {
  const sameOwner =
    current?.owner.scopeKey === candidate.owner.scopeKey &&
    current.owner.sessionId === candidate.owner.sessionId;
  return {
    ...candidate,
    revision: sameOwner ? current.revision + 1 : 1,
  };
}

function createSnapshot(
  model: IHomeSemanticModel,
  revision: number,
): IHomeSemanticStoreSnapshot {
  const sections = {} as Record<
    IHomeSectionId,
    IVersionedHomeSemanticSlice<IHomeSectionSemanticModel>
  >;
  sectionIds.forEach((id) => {
    sections[id] = versioned(revision, model.sections[id]);
  });
  return {
    owner: model.owner,
    revision,
    shell: versioned(revision, model.shell),
    navigation: versioned(revision, model.navigation),
    sections,
  };
}

export class HomeSemanticStore {
  private snapshot: IHomeSemanticStoreSnapshot;

  private readonly listeners = new Set<() => void>();

  private shellAuthorityRevision = 0;

  private navigationAuthorityRevision = 0;

  private sectionAuthorityRevisions: Partial<Record<IHomeSectionId, number>> =
    {};

  constructor(initialModel: IHomeSemanticModel) {
    this.snapshot = createSnapshot(initialModel, 1);
  }

  publish(
    model: IHomeSemanticModel,
    authoritativeShell?: IHomeAuthoritativeShellSnapshot,
    authoritativeNavigation?: IHomeAuthoritativeNavigationSnapshot,
    authoritativeSections?: Partial<
      Record<IHomeSectionId, IHomeAuthoritativeSectionSnapshot>
    >,
  ): IHomeSemanticStoreSnapshot {
    const previous = this.snapshot;
    const ownerChanged =
      previous.owner.scopeKey !== model.owner.scopeKey ||
      previous.owner.sessionId !== model.owner.sessionId;
    if (ownerChanged) {
      this.shellAuthorityRevision = 0;
      this.navigationAuthorityRevision = 0;
      this.sectionAuthorityRevisions = {};
    }
    const shellOwnerMatches =
      authoritativeShell?.owner.scopeKey === model.owner.scopeKey &&
      authoritativeShell.owner.sessionId === model.owner.sessionId;
    let nextModel = model;
    if (
      shellOwnerMatches &&
      authoritativeShell.revision > this.shellAuthorityRevision
    ) {
      this.shellAuthorityRevision = authoritativeShell.revision;
      nextModel = { ...model, shell: authoritativeShell.value };
    } else if (!ownerChanged && this.shellAuthorityRevision > 0) {
      nextModel = { ...model, shell: previous.shell.value };
    }
    const navigationOwnerMatches =
      authoritativeNavigation?.owner.scopeKey === model.owner.scopeKey &&
      authoritativeNavigation.owner.sessionId === model.owner.sessionId;
    if (
      navigationOwnerMatches &&
      authoritativeNavigation.revision > this.navigationAuthorityRevision
    ) {
      this.navigationAuthorityRevision = authoritativeNavigation.revision;
      nextModel = {
        ...nextModel,
        navigation: authoritativeNavigation.value,
      };
    } else if (!ownerChanged && this.navigationAuthorityRevision > 0) {
      nextModel = { ...nextModel, navigation: previous.navigation.value };
    }
    const authoritativeSectionValues = { ...nextModel.sections };
    sectionIds.forEach((id) => {
      const candidate = authoritativeSections?.[id];
      const ownerMatches =
        candidate?.owner.scopeKey === model.owner.scopeKey &&
        candidate.owner.sessionId === model.owner.sessionId;
      if (
        ownerMatches &&
        candidate.sectionId === id &&
        candidate.revision > (this.sectionAuthorityRevisions[id] ?? 0)
      ) {
        this.sectionAuthorityRevisions[id] = candidate.revision;
        authoritativeSectionValues[id] = candidate.value;
      } else if (
        !ownerChanged &&
        (this.sectionAuthorityRevisions[id] ?? 0) > 0
      ) {
        authoritativeSectionValues[id] = previous.sections[id].value;
      }
    });
    nextModel = { ...nextModel, sections: authoritativeSectionValues };
    if (ownerChanged) {
      this.snapshot = createSnapshot(nextModel, previous.revision + 1);
      this.notify();
      return this.snapshot;
    }

    const shellChanged = !areEqual(previous.shell.value, nextModel.shell);
    const navigationChanged = !areEqual(
      previous.navigation.value,
      nextModel.navigation,
    );
    const changedSections = sectionIds.filter(
      (id) => !areEqual(previous.sections[id].value, nextModel.sections[id]),
    );
    if (!shellChanged && !navigationChanged && changedSections.length === 0) {
      return previous;
    }

    const revision = previous.revision + 1;
    const nextSections = { ...previous.sections };
    changedSections.forEach((id) => {
      nextSections[id] = versioned(revision, nextModel.sections[id]);
    });
    this.snapshot = {
      owner: previous.owner,
      revision,
      shell: shellChanged
        ? versioned(revision, nextModel.shell)
        : previous.shell,
      navigation: navigationChanged
        ? versioned(revision, nextModel.navigation)
        : previous.navigation,
      sections: nextSections,
    };
    this.notify();
    return this.snapshot;
  }

  getSnapshot(): IHomeSemanticStoreSnapshot {
    return this.snapshot;
  }

  materializeHomeSemanticModel(): IHomeSemanticModel {
    return {
      owner: this.snapshot.owner,
      shell: this.snapshot.shell.value,
      navigation: this.snapshot.navigation.value,
      sections: Object.fromEntries(
        sectionIds.map((id) => [id, this.snapshot.sections[id].value]),
      ) as Record<IHomeSectionId, IHomeSectionSemanticModel>,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export {
  advanceHomeAuthoritativeNavigationSnapshot,
  advanceHomeAuthoritativeShellSnapshot,
};
