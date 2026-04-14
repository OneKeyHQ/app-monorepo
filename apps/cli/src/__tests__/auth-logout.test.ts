import { Command } from 'commander';

import { registerAuthLogoutCommand } from '../commands/auth/auth-logout';
import { executeAuthLogoutCommand } from '../commands/auth/auth-logout-command';

jest.mock('../commands/auth/auth-logout-command', () => ({
  executeAuthLogoutCommand: jest.fn(async () => undefined),
}));

const mockedExecuteAuthLogoutCommand = jest.mocked(executeAuthLogoutCommand);

async function parseAuthLogout(argv: string[]) {
  const program = new Command();
  program.option('--yes', 'Skip confirmation prompts');

  const auth = program.command('auth');
  registerAuthLogoutCommand(auth);

  await program.parseAsync(['node', 'onekey', ...argv]);
}

describe('registerAuthLogoutCommand', () => {
  beforeEach(() => {
    mockedExecuteAuthLogoutCommand.mockClear();
  });

  it('forwards root --yes passed after auth logout to skipConfirmation', async () => {
    await parseAuthLogout(['auth', 'logout', '--yes']);

    expect(mockedExecuteAuthLogoutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        skipConfirmation: true,
      }),
    );
  });

  it('forwards root --yes passed before auth logout to skipConfirmation', async () => {
    await parseAuthLogout(['--yes', 'auth', 'logout']);

    expect(mockedExecuteAuthLogoutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        skipConfirmation: true,
      }),
    );
  });

  it('keeps skipConfirmation false when --yes is not provided', async () => {
    await parseAuthLogout(['auth', 'logout']);

    expect(mockedExecuteAuthLogoutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        skipConfirmation: false,
      }),
    );
  });
});
