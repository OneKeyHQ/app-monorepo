#!/usr/bin/env node
// oxlint-disable @cspell/spellchecker

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Major global cities list, all lowercase
const CITIES = [
  'tokyo',
  'beijing',
  'shanghai',
  'mumbai',
  'london',
  'new-york',
  'los-angeles',
  'paris',
  'dubai',
  'singapore',
  'hong-kong',
  'sydney',
  'toronto',
  'mexico-city',
  'bangkok',
  'jakarta',
  'istanbul',
  'moscow',
  'seoul',
  'berlin',
  'madrid',
  'rome',
  'amsterdam',
  'vienna',
  'prague',
  'warsaw',
  'stockholm',
  'oslo',
  'copenhagen',
  'helsinki',
  'athens',
  'cairo',
  'johannesburg',
  'lagos',
  'nairobi',
  'cape-town',
  'buenos-aires',
  'sao-paulo',
  'rio',
];

function getRandomCity() {
  return CITIES[Math.floor(Math.random() * CITIES.length)];
}

function getDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}${day}`;
}

function getTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

function getCurrentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf-8',
    }).trim();
  } catch (_error) {
    console.error('❌ Failed to get current branch');
    process.exit(1);
  }
}

function getRepoRoot() {
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        encoding: 'utf-8',
      },
    ).trim();

    // Always place generated worktrees under the main repository root,
    // even when this script is invoked from an existing worktree.
    if (path.basename(gitCommonDir) === '.git') {
      return path.dirname(gitCommonDir);
    }

    return gitCommonDir;
  } catch (_error) {
    try {
      return execFileSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
      }).trim();
    } catch (_nestedError) {
      console.error('❌ Failed to get repository root');
      process.exit(1);
    }
  }
}

function getCurrentTopLevelPath() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
    }).trim();
  } catch (_error) {
    console.error('❌ Failed to get current worktree path');
    process.exit(1);
  }
}

function quoteForShell(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function resolveWorktreePath(worktreeDir, worktreeName) {
  const worktreeRoot = path.resolve(worktreeDir);
  const worktreePath = path.resolve(worktreeDir, worktreeName);

  if (
    worktreePath === worktreeRoot ||
    !worktreePath.startsWith(`${worktreeRoot}${path.sep}`)
  ) {
    console.error('\n❌ Invalid worktree name');
    process.exit(1);
  }

  return worktreePath;
}

function validateBranchName(branchName) {
  try {
    execFileSync('git', ['check-ref-format', '--branch', branchName], {
      stdio: 'pipe',
    });
  } catch (_error) {
    console.error(`\n❌ Invalid branch name: ${branchName}`);
    process.exit(1);
  }
}

function branchExists(branchName) {
  try {
    execFileSync(
      'git',
      ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
      {
        stdio: 'pipe',
      },
    );
    return true;
  } catch (_error) {
    return false;
  }
}

function isWorktreeTargetAvailable(worktreePath, branchName) {
  return !fs.existsSync(worktreePath) && !branchExists(branchName);
}

function getCurrentWorktreeName(repoRoot, currentTopLevelPath) {
  const worktreeDir = path.join(repoRoot, '.worktree');
  const relativePath = path.relative(worktreeDir, currentTopLevelPath);

  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return relativePath;
}

function getAvailableRandomWorktreeTarget(worktreeDir) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const city = getRandomCity();
    const date = getDateString();
    const branchName = `${city}-${date}`;
    const worktreePath = resolveWorktreePath(worktreeDir, branchName);

    if (isWorktreeTargetAvailable(worktreePath, branchName)) {
      return {
        branchName,
        city,
        date,
        worktreePath,
      };
    }
  }

  console.error(
    `\n❌ Failed to generate a unique random worktree name after ${maxAttempts} attempts`,
  );
  process.exit(1);
}

function getDerivedWorktreeTarget(worktreeDir, currentWorktreeName) {
  const time = getTimeString();
  const branchName = `${currentWorktreeName}-${time}`;
  const worktreePath = resolveWorktreePath(worktreeDir, branchName);

  if (!isWorktreeTargetAvailable(worktreePath, branchName)) {
    console.error(`\n❌ Worktree name already exists: ${branchName}`);
    process.exit(1);
  }

  return {
    branchName,
    time,
    worktreePath,
  };
}

function parseArgs(rawArgs) {
  let customName;
  let shouldShowHelp = false;
  const commandArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === '--') {
      commandArgs.push(...rawArgs.slice(index + 1));
      break;
    }

    if (arg === '-n' || arg === '--name') {
      const nextArg = rawArgs[index + 1];

      if (!nextArg) {
        throw new Error(`Missing value for ${arg}`);
      }

      customName = nextArg;
      index += 1;
    } else if (arg.startsWith('--name=')) {
      customName = arg.slice('--name='.length);

      if (!customName) {
        throw new Error('Missing value for --name');
      }
    } else if (arg === 'help' || arg === '-h' || arg === '--help') {
      shouldShowHelp = true;
      break;
    } else {
      commandArgs.push(...rawArgs.slice(index));
      break;
    }
  }

  return {
    commandArgs,
    customName,
    showHelp: shouldShowHelp,
  };
}

function shouldStayInWorktreeShell(commandArgs) {
  const commandName = path.basename(commandArgs[0] || '');
  return commandName === 'codex' || commandName === 'claude';
}

function getScriptRunnerShell() {
  if (fs.existsSync('/bin/zsh')) {
    return '/bin/zsh';
  }

  if (fs.existsSync('/bin/bash')) {
    return '/bin/bash';
  }

  return '/bin/sh';
}

function getScriptRunnerArgs(scriptRunnerShell, shellScript) {
  if (scriptRunnerShell === '/bin/sh') {
    return ['-c', shellScript];
  }

  return ['-l', '-i', '-c', shellScript];
}

function runCommandInWorktree({
  commandToRun,
  shellPath,
  stayInWorktreeShell,
  worktreePath,
}) {
  if (!stayInWorktreeShell) {
    execFileSync(
      shellPath,
      ['-lc', `cd ${quoteForShell(worktreePath)} && exec ${commandToRun}`],
      {
        cwd: worktreePath,
        stdio: 'inherit',
      },
    );
    return;
  }

  const shellScript = `
cd ${quoteForShell(worktreePath)} || exit 1
${commandToRun}
command_status=$?
echo
if [ "$command_status" -eq 0 ]; then
  echo "💡 Command finished. Staying in this worktree shell."
else
  echo "⚠️  Command exited with status $command_status. Staying in this worktree shell."
fi
echo "📂 Current directory: ${worktreePath}"
echo "↩️  Exit this shell to return to the original terminal."
exec ${quoteForShell(shellPath)} -i
`;

  const scriptRunnerShell = getScriptRunnerShell();
  execFileSync(
    scriptRunnerShell,
    getScriptRunnerArgs(scriptRunnerShell, shellScript),
    {
      cwd: worktreePath,
      stdio: 'inherit',
    },
  );
}

function createWorktreeAndRunCommand({
  commandArgs,
  commandToRun,
  customName,
}) {
  const repoRoot = getRepoRoot();
  const currentTopLevelPath = getCurrentTopLevelPath();
  const currentBranch = getCurrentBranch();
  const worktreeDir = path.join(repoRoot, '.worktree');
  const currentWorktreeName = customName
    ? null
    : getCurrentWorktreeName(repoRoot, currentTopLevelPath);
  const derivedTarget =
    customName || !currentWorktreeName
      ? null
      : getDerivedWorktreeTarget(worktreeDir, currentWorktreeName);
  const randomTarget =
    customName || currentWorktreeName
      ? null
      : getAvailableRandomWorktreeTarget(worktreeDir);
  const city = customName || currentWorktreeName ? null : randomTarget.city;
  const date = customName || currentWorktreeName ? null : randomTarget.date;
  const time = customName || !currentWorktreeName ? null : derivedTarget.time;
  const branchName =
    customName || derivedTarget?.branchName || randomTarget.branchName;
  const worktreePath = customName
    ? resolveWorktreePath(worktreeDir, branchName)
    : derivedTarget?.worktreePath || randomTarget.worktreePath;
  const shellPath = process.env.SHELL || '/bin/zsh';
  const stayInWorktreeShell = shouldStayInWorktreeShell(commandArgs);

  console.log(`\n📍 Current branch: ${currentBranch}`);
  if (customName) {
    console.log(`🏷️  Custom name: ${customName}`);
  } else if (currentWorktreeName) {
    console.log(`🧬 Source worktree: ${currentWorktreeName}`);
    console.log(`🕒 Time suffix: ${time}`);
  } else {
    console.log(`🌍 Random city: ${city}`);
    console.log(`📅 Date: ${date}`);
  }
  console.log(`🌿 New branch: ${branchName}`);
  console.log(`📂 Worktree path: ${worktreePath}`);
  console.log(`📝 Command: ${commandToRun}\n`);
  if (stayInWorktreeShell) {
    console.log(
      '🐚 This command keeps you in the new worktree shell after it exits\n',
    );
  }

  try {
    if (!fs.existsSync(worktreeDir)) {
      fs.mkdirSync(worktreeDir, { recursive: true });
    }

    validateBranchName(branchName);
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

    console.log('⚙️  Creating worktree...');
    execFileSync('git', ['worktree', 'add', worktreePath, '-b', branchName], {
      stdio: 'inherit',
    });

    console.log(`\n✅ Worktree created successfully!`);
    console.log(`📂 Changed directory to: ${worktreePath}`);
    console.log(`\n🚀 Running command in this worktree...\n`);

    try {
      process.chdir(worktreePath);
      runCommandInWorktree({
        commandToRun,
        shellPath,
        stayInWorktreeShell,
        worktreePath,
      });
    } catch (_error) {
      console.log(`\n✋ Command ended`);
    }

    console.log(`\n🧹 To remove this worktree later, run:`);
    console.log(`   git worktree remove "${worktreePath}"`);
  } catch (error) {
    console.error('\n❌ Failed to create worktree');
    console.error(error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Usage: yarn worktree [-n <name> | --name <name>] [--] <command...>

Creates a new worktree based on current branch, then cd's into it before
executing the given command. codex and claude stay in the new worktree shell
after they exit. Without -n/--name, it uses:
- current worktree name + HHmm when invoked from an existing worktree
- otherwise a random city+date name, with up to 5 retries on collisions

Examples (quotes optional):
  yarn worktree claude
  yarn worktree -n fix-wallet claude
  yarn worktree --name fix-wallet yarn app:web
  yarn worktree yarn app:web
  yarn worktree yarn app:web --port 3000
  yarn worktree npm run test -- --watch
  yarn worktree -- -h              # Pass flags through to the target command
  yarn worktree help                # Show this help message
  `);
}

function main() {
  let parsedArgs;

  try {
    parsedArgs = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    showHelp();
    process.exit(1);
  }

  if (parsedArgs.showHelp || parsedArgs.commandArgs.length === 0) {
    showHelp();
    return;
  }

  createWorktreeAndRunCommand({
    commandArgs: parsedArgs.commandArgs,
    commandToRun: parsedArgs.commandArgs.join(' '),
    customName: parsedArgs.customName,
  });
}

main();
