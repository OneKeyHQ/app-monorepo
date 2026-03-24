import { registerSecurityAuditCommand } from './security-audit';
import { registerSecuritySimulateCommand } from './security-simulate';

import type { Command } from 'commander';

export function registerSecurityCommands(program: Command) {
  const security = program
    .command('security')
    .description('Address and transaction security checks');

  registerSecurityAuditCommand(security);
  registerSecuritySimulateCommand(security);
}
