import { projectHomeCapabilities } from '../capabilities/homeCapabilityPolicy';
import { projectHomeBackupShell } from '../policies/homeBackupPolicy';
import { projectHomePortfolioPresentation } from '../policies/homePortfolioPolicy';
import { projectHomeSection } from '../policies/homeSectionPolicy';

import type {
  IHomeAuthoritativeNavigationSnapshot,
  IHomeAuthoritativeSectionSnapshot,
  IHomeAuthoritativeShellSnapshot,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeSemanticModel,
} from './homeSemanticTypes';
import type { IHomeFacts } from '../facts/homeFacts';

const sectionIds: readonly IHomeSectionId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
];

export function projectHomeSemanticModel({
  authoritativeNavigation,
  authoritativeShell,
  authoritativeSections,
  facts,
  selectedTabId,
}: {
  authoritativeNavigation?: IHomeAuthoritativeNavigationSnapshot;
  authoritativeShell?: IHomeAuthoritativeShellSnapshot;
  authoritativeSections?: Partial<
    Record<IHomeSectionId, IHomeAuthoritativeSectionSnapshot>
  >;
  facts: IHomeFacts;
  selectedTabId?: string;
}): IHomeSemanticModel {
  const capabilities = projectHomeCapabilities({ facts, selectedTabId });
  const authoritativeNavigationMatches =
    authoritativeNavigation?.owner.scopeKey === facts.ownerToken.scopeKey &&
    authoritativeNavigation.owner.sessionId === facts.ownerToken.sessionId;
  const navigation = authoritativeNavigationMatches
    ? authoritativeNavigation.value
    : capabilities.navigation;
  const capabilitySections =
    navigation.kind === 'ready' && navigation.sections
      ? navigation.sections
      : capabilities.sections;
  const backupShell = projectHomeBackupShell(facts);
  const projectsPortfolioShell = backupShell === undefined;
  const sections = {} as Record<IHomeSectionId, IHomeSectionSemanticModel>;
  sectionIds.forEach((id) => {
    const authoritative = authoritativeSections?.[id];
    sections[id] =
      authoritative?.owner.scopeKey === facts.ownerToken.scopeKey &&
      authoritative.owner.sessionId === facts.ownerToken.sessionId &&
      authoritative.sectionId === id
        ? authoritative.value
        : projectHomeSection({
            applicable: projectsPortfolioShell && capabilitySections[id],
            confirmed: facts.confirmed[id],
            id,
            resource: facts.sources[id],
          });
  });
  return {
    owner: facts.ownerToken,
    shell:
      authoritativeShell?.owner.scopeKey === facts.ownerToken.scopeKey &&
      authoritativeShell.owner.sessionId === facts.ownerToken.sessionId
        ? authoritativeShell.value
        : (backupShell ?? {
            kind: 'portfolio',
            presentation: projectHomePortfolioPresentation(facts),
          }),
    navigation: projectsPortfolioShell ? navigation : { kind: 'hidden' },
    sections,
  };
}
