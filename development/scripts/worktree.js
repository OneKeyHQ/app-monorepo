#!/usr/bin/env node
// oxlint-disable @cspell/spellchecker

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ANSI = {
  black: '\x1b[30m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
  bgCyan: '\x1b[46m',
};

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

function styleText(text, ...styles) {
  if (!process.stdout.isTTY) {
    return text;
  }

  return `${styles.filter(Boolean).join('')}${text}${ANSI.reset}`;
}

function truncateText(text, maxLength) {
  if (maxLength <= 0 || text.length <= maxLength) {
    return text;
  }

  if (maxLength === 1) {
    return '…';
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function getTerminalWidth() {
  const fallbackWidth = 96;
  return Math.max(72, Math.min(process.stdout.columns || fallbackWidth, 120));
}

function createSectionDivider(title, width) {
  const dividerTitle = ` ${title} `;
  const dividerPadding = '─'.repeat(Math.max(0, width - dividerTitle.length));

  return `${styleText(dividerTitle, ANSI.bold, ANSI.cyan)}${styleText(
    dividerPadding,
    ANSI.gray,
  )}`;
}

function formatField(label, value, width, { selected = false } = {}) {
  const labelWidth = 8;
  const plainValue = truncateText(value, Math.max(16, width - labelWidth - 1));
  const labelText = styleText(
    label.padEnd(labelWidth),
    selected ? ANSI.cyan : ANSI.gray,
  );
  const valueText = selected ? plainValue : styleText(plainValue, ANSI.dim);

  return `${labelText} ${valueText}`;
}

function getResolvedWorktreePath(worktreeDir, worktreeName) {
  const worktreeRoot = path.resolve(worktreeDir);
  const worktreePath = path.resolve(worktreeDir, worktreeName);

  if (
    worktreePath === worktreeRoot ||
    !worktreePath.startsWith(`${worktreeRoot}${path.sep}`)
  ) {
    throw new Error('Invalid worktree name');
  }

  return worktreePath;
}

function resolveWorktreePath(worktreeDir, worktreeName) {
  try {
    return getResolvedWorktreePath(worktreeDir, worktreeName);
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    process.exit(1);
  }
}

function getBranchNameValidationError(branchName) {
  try {
    execFileSync('git', ['check-ref-format', '--branch', branchName], {
      stdio: 'pipe',
    });
    return null;
  } catch (_error) {
    return `Invalid branch name: ${branchName}`;
  }
}

function validateBranchName(branchName) {
  const errorMessage = getBranchNameValidationError(branchName);

  if (errorMessage) {
    console.error(`\n❌ ${errorMessage}`);
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
        kind: 'create',
        mode: 'random',
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
  const maxAttempts = 5;
  const time = getTimeString();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = attempt === 0 ? time : `${time}-${attempt + 1}`;
    const branchName = `${currentWorktreeName}-${suffix}`;
    const worktreePath = resolveWorktreePath(worktreeDir, branchName);

    if (isWorktreeTargetAvailable(worktreePath, branchName)) {
      return {
        kind: 'create',
        mode: 'derived',
        branchName,
        sourceWorktreeName: currentWorktreeName,
        time: suffix,
        worktreePath,
      };
    }
  }

  console.error(
    `\n❌ Failed to generate a unique worktree name for ${currentWorktreeName}`,
  );
  process.exit(1);
}

function getCustomWorktreeTarget(worktreeDir, branchName) {
  return {
    kind: 'create',
    mode: 'custom',
    branchName,
    worktreePath: resolveWorktreePath(worktreeDir, branchName),
  };
}

function getDefaultCreateTarget(worktreeDir, currentWorktreeName) {
  if (currentWorktreeName) {
    return getDerivedWorktreeTarget(worktreeDir, currentWorktreeName);
  }

  return getAvailableRandomWorktreeTarget(worktreeDir);
}

function parseBranchName(branchRef) {
  if (!branchRef) {
    return '(detached)';
  }

  const prefix = 'refs/heads/';
  return branchRef.startsWith(prefix)
    ? branchRef.slice(prefix.length)
    : branchRef;
}

function parseWorktreeList(output) {
  const entries = [];
  const blocks = output.trim().split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const entry = {};

    for (const line of block.split('\n')) {
      const separatorIndex = line.indexOf(' ');
      const key = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      const value =
        separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim();

      if (key === 'worktree') {
        entry.path = value;
      } else if (key === 'HEAD') {
        entry.head = value;
      } else if (key === 'branch') {
        entry.branchRef = value;
      } else if (key === 'detached') {
        entry.detached = true;
      }
    }

    if (entry.path) {
      entries.push(entry);
    }
  }

  return entries;
}

function getWorktreeDisplayName(repoRoot, worktreePath) {
  if (path.resolve(worktreePath) === path.resolve(repoRoot)) {
    return 'base';
  }

  const managedWorktreeRoot = path.join(repoRoot, '.worktree');
  const relativeManagedPath = path.relative(managedWorktreeRoot, worktreePath);

  if (
    relativeManagedPath &&
    !relativeManagedPath.startsWith('..') &&
    !path.isAbsolute(relativeManagedPath)
  ) {
    return relativeManagedPath;
  }

  return path.basename(worktreePath);
}

function getWorktreePathLabel(repoRoot, worktreePath) {
  const relativePath = path.relative(repoRoot, worktreePath);
  return relativePath || '.';
}

function getExistingWorktrees(repoRoot, currentTopLevelPath) {
  const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    encoding: 'utf-8',
  });

  return parseWorktreeList(output).map((entry) => ({
    ...entry,
    branchName: parseBranchName(entry.branchRef),
    displayName: getWorktreeDisplayName(repoRoot, entry.path),
    pathLabel: getWorktreePathLabel(repoRoot, entry.path),
    isBase: path.resolve(entry.path) === path.resolve(repoRoot),
    isCurrent: path.resolve(entry.path) === path.resolve(currentTopLevelPath),
  }));
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

function getCreatePreview({
  defaultTarget,
  inputValue,
  repoRoot,
  worktreeDir,
}) {
  const trimmedName = inputValue.trim();

  if (!trimmedName) {
    let modeLabel = 'Auto-generated name';

    if (defaultTarget.mode === 'derived') {
      modeLabel = `From ${defaultTarget.sourceWorktreeName} + ${defaultTarget.time}`;
    } else if (defaultTarget.mode === 'random') {
      modeLabel = `Random ${defaultTarget.city} + ${defaultTarget.date}`;
    }

    return {
      branchName: defaultTarget.branchName,
      modeLabel,
      nameLabel: `${defaultTarget.branchName} (auto)`,
      pathLabel: getWorktreePathLabel(repoRoot, defaultTarget.worktreePath),
    };
  }

  let pathLabel = `.worktree/${trimmedName}`;

  try {
    pathLabel = getWorktreePathLabel(
      repoRoot,
      getResolvedWorktreePath(worktreeDir, trimmedName),
    );
  } catch (_error) {
    // Keep a best-effort preview path while the user is typing.
  }

  return {
    branchName: trimmedName,
    modeLabel: 'Typed name',
    nameLabel: trimmedName,
    pathLabel,
  };
}

function formatOptionTag(tag, { selected = false, tone = ANSI.cyan } = {}) {
  if (selected) {
    return styleText(` ${tag} `, ANSI.bold, ANSI.black, ANSI.bgCyan);
  }

  return styleText(`[${tag}]`, ANSI.bold, tone);
}

function renderOptionCard({ details, selected, tag, tagTone, title, width }) {
  const prefix = selected ? styleText('❯', ANSI.bold, ANSI.cyan) : ' ';
  const titleWidth = Math.max(20, width - 12);
  const titleText = truncateText(title, titleWidth);
  const renderedTitle = selected ? styleText(titleText, ANSI.bold) : titleText;
  const lines = [
    `${prefix} ${formatOptionTag(tag, {
      selected,
      tone: tagTone,
    })} ${renderedTitle}`,
  ];

  for (const [label, value] of details) {
    lines.push(`    ${formatField(label, value, width - 4, { selected })}`);
  }

  return lines;
}

function renderWorktreeSelector({
  defaultTarget,
  errorMessage,
  inputValue,
  repoRoot,
  selectedIndex,
  worktreeDir,
  worktrees,
}) {
  const width = getTerminalWidth();
  const createPreview = getCreatePreview({
    defaultTarget,
    inputValue,
    repoRoot,
    worktreeDir,
  });
  const optionLines = [
    ...renderOptionCard({
      details: [
        ['Branch', createPreview.branchName],
        ['Path', createPreview.pathLabel],
        ['Mode', createPreview.modeLabel],
      ],
      selected: selectedIndex === 0,
      tag: 'NEW',
      tagTone: ANSI.green,
      title: 'Create new worktree',
      width,
    }),
    ...worktrees.flatMap((entry, index) => {
      let statusLabel = 'ready';
      let tag = 'WT';
      let tagTone = ANSI.green;
      let title = entry.displayName;

      if (entry.isBase) {
        statusLabel = 'base';
        tag = 'BASE';
        tagTone = ANSI.cyan;
        title = 'Base repository';
      } else if (entry.isCurrent) {
        statusLabel = 'current';
        tag = 'CUR';
        tagTone = ANSI.yellow;
      }

      return renderOptionCard({
        details: [
          ['Branch', entry.branchName],
          ['Path', entry.pathLabel],
          ['Status', statusLabel],
        ],
        selected: selectedIndex === index + 1,
        tag,
        tagTone,
        title,
        width,
      });
    }),
  ];

  const lines = [
    styleText('Worktree Picker', ANSI.bold, ANSI.cyan),
    styleText('Create a new worktree or jump into an existing one.', ANSI.dim),
    '',
    createSectionDivider('Create', width),
    formatField('Name', createPreview.nameLabel, width),
    '',
    createSectionDivider('Options', width),
    ...optionLines,
  ];

  if (errorMessage) {
    lines.push(
      '',
      createSectionDivider('Error', width),
      `${styleText('✖', ANSI.bold, ANSI.red)} ${styleText(
        truncateText(errorMessage, width - 2),
        ANSI.red,
      )}`,
    );
  }

  lines.push(
    '',
    createSectionDivider('Keys', width),
    `${styleText('↑/↓', ANSI.bold)} move  ${styleText('Enter', ANSI.bold)} confirm  ${styleText(
      'Esc',
      ANSI.bold,
    )} cancel`,
  );

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function getCreateTargetFromInput({ defaultTarget, inputValue, worktreeDir }) {
  const trimmedName = inputValue.trim();

  if (!trimmedName) {
    return defaultTarget;
  }

  let worktreePath;

  try {
    worktreePath = getResolvedWorktreePath(worktreeDir, trimmedName);
  } catch (error) {
    return {
      errorMessage: error.message,
    };
  }

  const branchError = getBranchNameValidationError(trimmedName);

  if (branchError) {
    return {
      errorMessage: branchError,
    };
  }

  if (!isWorktreeTargetAvailable(worktreePath, trimmedName)) {
    return {
      errorMessage: `Worktree name already exists: ${trimmedName}`,
    };
  }

  return {
    kind: 'create',
    mode: 'custom',
    branchName: trimmedName,
    worktreePath,
  };
}

function selectWorktreeTarget({
  defaultTarget,
  repoRoot,
  worktreeDir,
  worktrees,
}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(defaultTarget);
  }

  return new Promise((resolve, reject) => {
    let inputValue = '';
    let errorMessage = '';
    let selectedIndex = 0;
    const totalOptions = worktrees.length + 1;
    const previousRawMode = process.stdin.isRaw;

    const render = () => {
      renderWorktreeSelector({
        defaultTarget,
        errorMessage,
        inputValue,
        repoRoot,
        selectedIndex,
        worktreeDir,
        worktrees,
      });
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(Boolean(previousRawMode));
      }

      process.stdin.pause();
      process.stdout.write('\x1b[?25h');
      process.stdout.write('\x1b[2J\x1b[H');
    };

    const confirmSelection = () => {
      if (selectedIndex === 0) {
        const target = getCreateTargetFromInput({
          defaultTarget,
          inputValue,
          worktreeDir,
        });

        if (target.errorMessage) {
          errorMessage = target.errorMessage;
          render();
          return;
        }

        cleanup();
        resolve(target);
        return;
      }

      const selectedWorktree = worktrees[selectedIndex - 1];
      cleanup();
      resolve({
        kind: 'existing',
        mode: 'existing',
        branchName: selectedWorktree.branchName,
        displayName: selectedWorktree.displayName,
        isBase: selectedWorktree.isBase,
        isCurrent: selectedWorktree.isCurrent,
        worktreePath: selectedWorktree.path,
      });
    };

    const onKeypress = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      if (key.name === 'escape') {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + totalOptions) % totalOptions;
        errorMessage = '';
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % totalOptions;
        errorMessage = '';
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        confirmSelection();
        return;
      }

      if (key.name === 'backspace') {
        inputValue = inputValue.slice(0, -1);
        selectedIndex = 0;
        errorMessage = '';
        render();
        return;
      }

      if (!key.ctrl && !key.meta && str && /^[ -~]$/.test(str)) {
        inputValue += str;
        selectedIndex = 0;
        errorMessage = '';
        render();
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1b[?25l');
    process.stdin.on('keypress', onKeypress);
    render();
  });
}

function logWorktreeSelection({
  commandToRun,
  currentBranch,
  selection,
  stayInWorktreeShell,
}) {
  console.log(`\n📍 Current branch: ${currentBranch}`);

  if (selection.kind === 'existing') {
    console.log(
      `📚 Selected worktree: ${selection.isBase ? 'base' : selection.displayName}`,
    );
    console.log(`🌿 Target branch: ${selection.branchName}`);
  } else if (selection.mode === 'custom') {
    console.log(`🏷️  Custom name: ${selection.branchName}`);
    console.log(`🌿 New branch: ${selection.branchName}`);
  } else if (selection.mode === 'derived') {
    console.log(`🧬 Source worktree: ${selection.sourceWorktreeName}`);
    console.log(`🕒 Time suffix: ${selection.time}`);
    console.log(`🌿 New branch: ${selection.branchName}`);
  } else {
    console.log(`🌍 Random city: ${selection.city}`);
    console.log(`📅 Date: ${selection.date}`);
    console.log(`🌿 New branch: ${selection.branchName}`);
  }

  console.log(`📂 Worktree path: ${selection.worktreePath}`);
  console.log(`📝 Command: ${commandToRun}\n`);

  if (stayInWorktreeShell) {
    console.log(
      '🐚 This command keeps you in the selected worktree shell after it exits\n',
    );
  }
}

function runWorktreeCommand({ commandArgs, commandToRun, selection }) {
  const currentBranch = getCurrentBranch();
  const shellPath = process.env.SHELL || '/bin/zsh';
  const stayInWorktreeShell = shouldStayInWorktreeShell(commandArgs);

  logWorktreeSelection({
    commandToRun,
    currentBranch,
    selection,
    stayInWorktreeShell,
  });

  try {
    if (selection.kind === 'create') {
      validateBranchName(selection.branchName);
      fs.mkdirSync(path.dirname(selection.worktreePath), { recursive: true });

      console.log('⚙️  Creating worktree...');
      execFileSync(
        'git',
        ['worktree', 'add', selection.worktreePath, '-b', selection.branchName],
        {
          stdio: 'inherit',
        },
      );

      console.log('\n✅ Worktree created successfully!');
      console.log(`📂 Changed directory to: ${selection.worktreePath}`);
    } else {
      console.log('✅ Using existing worktree');
      console.log(`📂 Changed directory to: ${selection.worktreePath}`);
    }

    console.log(`\n🚀 Running command in this worktree...\n`);

    try {
      process.chdir(selection.worktreePath);
      runCommandInWorktree({
        commandToRun,
        shellPath,
        stayInWorktreeShell,
        worktreePath: selection.worktreePath,
      });
    } catch (_error) {
      console.log('\n✋ Command ended');
    }

    if (selection.kind === 'create') {
      console.log('\n🧹 To remove this worktree later, run:');
      console.log(`   git worktree remove "${selection.worktreePath}"`);
    }
  } catch (error) {
    console.error(
      selection.kind === 'create'
        ? '\n❌ Failed to create worktree'
        : '\n❌ Failed to use selected worktree',
    );
    console.error(error.message);
    process.exit(1);
  }
}

async function resolveWorktreeSelection({ customName }) {
  const repoRoot = getRepoRoot();
  const currentTopLevelPath = getCurrentTopLevelPath();
  const worktreeDir = path.join(repoRoot, '.worktree');
  const currentWorktreeName = customName
    ? null
    : getCurrentWorktreeName(repoRoot, currentTopLevelPath);

  if (!fs.existsSync(worktreeDir)) {
    fs.mkdirSync(worktreeDir, { recursive: true });
  }

  if (customName) {
    return getCustomWorktreeTarget(worktreeDir, customName);
  }

  const defaultTarget = getDefaultCreateTarget(
    worktreeDir,
    currentWorktreeName,
  );
  const existingWorktrees = getExistingWorktrees(repoRoot, currentTopLevelPath);

  return selectWorktreeTarget({
    defaultTarget,
    repoRoot,
    worktreeDir,
    worktrees: existingWorktrees,
  });
}

function showHelp() {
  console.log(`
Usage: yarn worktree [-n <name> | --name <name>] [--] <command...>

Creates a new worktree or runs the command in an existing one. Without -n/--name,
the script opens an interactive picker with:
- first item: create new worktree
- existing worktrees: includes the base repository and every managed worktree
- blank create name: auto-generate from current worktree + time, or random city+date

Examples (quotes optional):
  yarn worktree claude
  yarn worktree -n fix-wallet claude
  yarn worktree --name fix-wallet yarn app:web
  yarn worktree yarn app:web
  yarn worktree yarn app:web --port 3000
  yarn worktree npm run test -- --watch
  yarn worktree -- -h              # Pass flags through to the target command
  yarn worktree help               # Show this help message
  `);
}

async function main() {
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

  const selection = await resolveWorktreeSelection({
    customName: parsedArgs.customName,
  });

  runWorktreeCommand({
    commandArgs: parsedArgs.commandArgs,
    commandToRun: parsedArgs.commandArgs.join(' '),
    selection,
  });
}

main().catch((error) => {
  if (error.message === 'Cancelled') {
    console.error('\n✋ Worktree selection cancelled');
    process.exit(1);
  }

  console.error('\n❌ Failed to resolve worktree selection');
  console.error(error.message);
  process.exit(1);
});
