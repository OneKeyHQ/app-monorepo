// cspell:ignore LavaMoat lavamoat

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { packageManager } = require('../../package.json');

const { LavaMoatError } = require('./error.cjs');
const { enabledTargets } = require('./targets.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const yarn = path.join(
  repoRoot,
  '.yarn/releases',
  `${packageManager.replace('@', '-')}.cjs`,
);

function main([action, selection, ...extra]) {
  if (!['policy', 'build'].includes(action) || extra.length) {
    throw new LavaMoatError(
      'Usage: run-targets.cjs <policy|build> <all|target>',
    );
  }

  const targets =
    selection === 'all'
      ? enabledTargets
      : enabledTargets.filter((target) => target.scriptSuffix === selection);
  if (targets.length === 0) {
    throw new LavaMoatError(`Unknown LavaMoat target: ${selection}`);
  }

  const commands = [['copy:inject']];
  for (const target of targets) {
    const script =
      action === 'policy'
        ? target.workspacePolicyScript
        : target.workspaceBuildScript;
    if (target.workspacePackageJson === 'package.json') {
      commands.push([script]);
    } else {
      const { name } = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, target.workspacePackageJson),
          'utf8',
        ),
      );
      commands.push(['workspace', name, script]);
    }
  }

  if (action === 'policy') {
    commands.push(['lavamoat:normalize-policies'], ['lavamoat:review']);
  } else if (selection === 'all') {
    commands.push(['workspace', '@onekeyhq/ext', 'lavamoat:finalize']);
  }

  for (const args of commands) {
    console.log(`> yarn ${args.join(' ')}`);
    const result = spawnSync(process.execPath, [yarn, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

main(process.argv.slice(2));
