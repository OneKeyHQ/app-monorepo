const path = require('path');

const { findRepoYarnPath, resolveSpawnInvocation } = require('./exec');

describe('resolveSpawnInvocation', () => {
  const repoRoot = path.join(__dirname, '..', '..', '..');

  test('runs the repository Yarn release through Node on Windows', () => {
    const invocation = resolveSpawnInvocation('yarn', ['test'], {
      cwd: repoRoot,
      platform: 'win32',
    });

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0]).toBe(findRepoYarnPath(repoRoot));
    expect(invocation.args.slice(1)).toEqual(['test']);
  });

  test('does not rewrite native or non-Windows commands', () => {
    expect(
      resolveSpawnInvocation('git', ['status'], {
        cwd: repoRoot,
        platform: 'win32',
      }),
    ).toEqual({ command: 'git', args: ['status'] });
    expect(
      resolveSpawnInvocation('yarn', ['test'], {
        cwd: repoRoot,
        platform: 'linux',
      }),
    ).toEqual({ command: 'yarn', args: ['test'] });
  });
});
