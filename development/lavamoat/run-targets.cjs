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

function main([action, selection, ...options]) {
  const ciBuild = action === 'build' && selection === 'ci';
  const [group] = options;
  if (
    !['policy', 'build'].includes(action) ||
    (options.length > 0 &&
      (!ciBuild ||
        options.length !== 1 ||
        !['--registry-only', '--skip-registry'].includes(group)))
  ) {
    throw new LavaMoatError(
      'Usage: run-targets.cjs <policy|build> <all|target>, or run-targets.cjs build ci [--registry-only|--skip-registry]',
    );
  }

  const allTargets = selection === 'all' || ciBuild;
  let targets = allTargets
    ? enabledTargets
    : enabledTargets.filter((target) => target.scriptSuffix === selection);

  if (ciBuild) {
    // The renderer cleans the production output directory used by build:main.
    const registryTargets = targets.filter((target) => target.ciRegistryAuth);
    const remainingTargets = targets.filter((target) => !target.ciRegistryAuth);
    targets = [
      ...(group === '--skip-registry' ? [] : registryTargets),
      ...(group === '--registry-only' ? [] : remainingTargets),
    ];
  }

  if (targets.length === 0) {
    throw new LavaMoatError(`Unknown LavaMoat target: ${selection}`);
  }

  const commands = [{ args: ['copy:inject'] }];
  const productionBuilds = new Set();
  for (const target of targets) {
    const productionScript = ciBuild ? target.ciBuildScript : undefined;
    const script =
      action === 'policy'
        ? target.workspacePolicyScript
        : productionScript || target.workspaceBuildScript;
    const build = `${target.workspacePackageJson}:${script}`;

    if (!productionBuilds.has(build)) {
      let args = [script];
      if (target.workspacePackageJson !== 'package.json') {
        const { name } = JSON.parse(
          fs.readFileSync(
            path.join(repoRoot, target.workspacePackageJson),
            'utf8',
          ),
        );
        args = ['workspace', name, script];
      }
      commands.push({ args, env: ciBuild ? target.ciBuildEnv : undefined });
      if (productionScript) productionBuilds.add(build);
    }
  }

  if (action === 'policy') {
    commands.push(
      { args: ['lavamoat:normalize-policies'] },
      { args: ['lavamoat:review'] },
    );
  } else if (allTargets && group !== '--registry-only') {
    commands.push({
      args: ['workspace', '@onekeyhq/ext', 'lavamoat:finalize'],
    });
  }

  for (const { args, env } of commands) {
    console.log(`> yarn ${args.join(' ')}`);
    const useTimeout = ciBuild && process.platform === 'linux';
    const command = useTimeout ? 'timeout' : process.execPath;
    const commandArgs = useTimeout
      ? ['--kill-after=30s', '30m', process.execPath, yarn, ...args]
      : [yarn, ...args];
    const result = spawnSync(command, commandArgs, {
      cwd: repoRoot,
      env: env ? { ...process.env, ...env } : process.env,
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
