import { projectHomeCapabilities } from '../capabilities/homeCapabilityPolicy';
import { projectHomeBackupShell } from '../policies/homeBackupPolicy';
import { projectHomePortfolioPresentation } from '../policies/homePortfolioPolicy';
import { projectHomeSection } from '../policies/homeSectionPolicy';

import type {
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
  facts,
  selectedTabId,
}: {
  facts: IHomeFacts;
  selectedTabId?: string;
}): IHomeSemanticModel {
  const capabilities = projectHomeCapabilities({ facts, selectedTabId });
  const navigation = capabilities.navigation;
  const capabilitySections =
    navigation.kind === 'ready' && navigation.sections
      ? navigation.sections
      : capabilities.sections;
  const backupShell = projectHomeBackupShell(facts);
  const projectsPortfolioShell = backupShell === undefined;
  const sections = {} as Record<IHomeSectionId, IHomeSectionSemanticModel>;
  sectionIds.forEach((id) => {
    sections[id] = projectHomeSection({
      applicable: projectsPortfolioShell && capabilitySections[id],
      confirmed: facts.confirmed[id],
      id,
      resource: facts.sources[id],
    });
  });
  return {
    owner: facts.ownerToken,
    shell: backupShell ?? {
      kind: 'portfolio',
      presentation: projectHomePortfolioPresentation(facts),
    },
    navigation: projectsPortfolioShell ? navigation : { kind: 'hidden' },
    sections,
  };
}
