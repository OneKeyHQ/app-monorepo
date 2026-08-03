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
  return (
    projectHomeBackupShell(facts) ?? {
      kind: 'portfolio',
      presentation: portfolioPresentation,
    }
  );
}

export { projectHomeShell };
