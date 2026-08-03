import { projectHomeBackupShell } from './homeBackupPolicy';

import type { IHomeFacts } from '../facts/homeFacts';
import type {
  IHomePortfolioPresentation,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';

function projectHomeShell({
  facts,
  portfolioPresentation,
}: {
  facts: IHomeFacts;
  portfolioPresentation: IHomePortfolioPresentation;
}): IHomeShellSemanticModel {
  const backupShell = projectHomeBackupShell(facts);
  if (backupShell?.kind === 'backupRequired') {
    return {
      ...backupShell,
      presentation: portfolioPresentation,
    };
  }
  return (
    backupShell ?? {
      kind: 'portfolio',
      presentation: portfolioPresentation,
    }
  );
}

export { projectHomeShell };
