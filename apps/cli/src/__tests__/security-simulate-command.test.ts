import { Command } from 'commander';

import { registerSecuritySimulateCommand } from '../commands/security/security-simulate';
import { apiClient } from '../infra';

import type { OutputFormatter } from '../output';

describe('registerSecuritySimulateCommand', () => {
  let output: Pick<OutputFormatter, 'success' | 'error'>;

  beforeEach(() => {
    output = {
      success: jest.fn(),
      error: jest.fn(),
    };
    process.exitCode = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function parseSecuritySimulate(argv: string[]) {
    const program = new Command();
    const security = program.command('security');

    program.hook('preAction', (_thisCommand, actionCommand) => {
      actionCommand.setOptionValue('_outputFormatter', output);
    });

    registerSecuritySimulateCommand(security);

    await program.parseAsync(['node', 'onekey', ...argv]);
  }

  it('accepts parse-transaction payloads without display/type', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      parsedTx: {
        data: {
          hexSignature: '0x095ea7b3',
          textSignature: 'approve(address,uint256)',
          name: 'approve',
        },
        to: {
          address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
          name: 'Circle: USD Coin (USDC)',
          labels: null,
          isContract: true,
          riskLevel: 1,
        },
      },
      accountAddress: '0x0000000000000000000000000000000000000001',
    });

    await parseSecuritySimulate([
      'security',
      'simulate',
      '--chain',
      'arbitrum',
      '--to',
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      '--data',
      '0x095ea7b3',
    ]);

    expect(output.success).toHaveBeenCalledWith(
      {
        type: null,
        display: null,
        parsedTx: {
          data: {
            hexSignature: '0x095ea7b3',
            textSignature: 'approve(address,uint256)',
            name: 'approve',
          },
          to: {
            address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
            name: 'Circle: USD Coin (USDC)',
            labels: null,
            isContract: true,
            riskLevel: 1,
          },
        },
        accountAddress: '0x0000000000000000000000000000000000000001',
        isConfirmationRequired: false,
      },
      { chain: 'arbitrum' },
    );
    expect(output.error).not.toHaveBeenCalled();
  });
});
