#!/usr/bin/env node
// oxlint-disable @cspell/spellchecker

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const METADATA_FILE_NAME = 'worktree-meta.json';
const METADATA_VERSION = 1;

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

function getGitCommonDir() {
  try {
    return execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf-8' },
    ).trim();
  } catch (_error) {
    console.error('❌ Failed to locate git common dir');
    process.exit(1);
  }
}

function getMetadataFilePath(gitCommonDir) {
  return path.join(gitCommonDir, METADATA_FILE_NAME);
}

function createEmptyMetadata() {
  return { version: METADATA_VERSION, worktrees: {} };
}

function readMetadata(metadataFilePath) {
  if (!fs.existsSync(metadataFilePath)) {
    return createEmptyMetadata();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));

    if (!parsed || typeof parsed !== 'object' || !parsed.worktrees) {
      return createEmptyMetadata();
    }

    return {
      version: parsed.version || METADATA_VERSION,
      worktrees: { ...parsed.worktrees },
    };
  } catch (_error) {
    // Corrupt metadata is non-fatal: rebuild on the fly from live worktrees.
    return createEmptyMetadata();
  }
}

function writeMetadata(metadataFilePath, metadata) {
  const tmpPath = `${metadataFilePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(metadata, null, 2)}\n`);
  fs.renameSync(tmpPath, metadataFilePath);
}

function metadataEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function syncMetadataWithExistingWorktrees(metadata, existingWorktrees) {
  const nextWorktrees = { ...metadata.worktrees };
  const liveNames = new Set(
    existingWorktrees
      .filter((entry) => !entry.isBase)
      .map((entry) => entry.displayName),
  );

  for (const name of Object.keys(nextWorktrees)) {
    if (!liveNames.has(name)) {
      delete nextWorktrees[name];
    }
  }

  // Pre-existing worktrees created before metadata was introduced: record
  // them as orphans so they show up in the tree but claim no parent.
  for (const entry of existingWorktrees) {
    if (!entry.isBase && !nextWorktrees[entry.displayName]) {
      nextWorktrees[entry.displayName] = {
        branch: entry.branchName,
        parent: null,
        parentBranch: null,
        createdAt: null,
        createdFromBranch: null,
      };
    }
  }

  return { version: METADATA_VERSION, worktrees: nextWorktrees };
}

function getWorktreeRandomHash() {
  return crypto.randomBytes(2).toString('hex');
}

function recordCreatedWorktreeMetadata({
  branchName,
  createdFromBranch,
  displayName,
  parentName,
}) {
  const metadataFilePath = getMetadataFilePath(getGitCommonDir());
  const metadata = readMetadata(metadataFilePath);
  metadata.worktrees[displayName] = {
    branch: branchName,
    parent: parentName || null,
    parentBranch: createdFromBranch || null,
    createdAt: new Date().toISOString(),
    createdFromBranch: createdFromBranch || null,
  };
  writeMetadata(metadataFilePath, metadata);
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

function getAutoCreateTarget(worktreeDir) {
  const maxAttempts = 5;
  const date = getDateString();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const city = getRandomCity();
    const hash = getWorktreeRandomHash();
    const branchName = `${city}-${date}-${hash}`;
    const worktreePath = resolveWorktreePath(worktreeDir, branchName);

    if (isWorktreeTargetAvailable(worktreePath, branchName)) {
      return {
        kind: 'create',
        mode: 'auto',
        branchName,
        city,
        date,
        hash,
        worktreePath,
      };
    }
  }

  console.error(
    `\n❌ Failed to generate a unique worktree name after ${maxAttempts} attempts`,
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

function buildWorktreeTreeOrder(existingWorktrees, metadata) {
  // base first (fixed at depth 0, not part of the managed tree)
  const baseEntries = existingWorktrees.filter((entry) => entry.isBase);
  const managedEntries = existingWorktrees.filter((entry) => !entry.isBase);
  const byName = new Map(
    managedEntries.map((entry) => [entry.displayName, entry]),
  );
  const childrenByParent = new Map();

  for (const entry of managedEntries) {
    const meta = metadata.worktrees[entry.displayName];
    const parentName =
      meta && meta.parent && byName.has(meta.parent) ? meta.parent : null;

    if (!childrenByParent.has(parentName)) {
      childrenByParent.set(parentName, []);
    }
    childrenByParent.get(parentName).push(entry);
  }

  const sortSiblings = (entries) => {
    entries.sort((a, b) => {
      const aCreated = metadata.worktrees[a.displayName]?.createdAt || '';
      const bCreated = metadata.worktrees[b.displayName]?.createdAt || '';
      if (aCreated && bCreated) return aCreated.localeCompare(bCreated);
      if (aCreated) return -1;
      if (bCreated) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return entries;
  };

  const ordered = [];
  const walk = (parentName, depth) => {
    const siblings = sortSiblings(childrenByParent.get(parentName) || []);
    siblings.forEach((entry, index) => {
      ordered.push({
        ...entry,
        depth,
        isLastSibling: index === siblings.length - 1,
      });
      walk(entry.displayName, depth + 1);
    });
  };

  walk(null, 0);

  return [
    ...baseEntries.map((entry) => ({
      ...entry,
      depth: 0,
      isLastSibling: true,
    })),
    ...ordered,
  ];
}

function getTreePrefix(depth) {
  if (depth <= 0) return '';
  // Depth >= 1 → one level of indent per step, branch marker on the last one.
  return `${'  '.repeat(depth - 1)}└─ `;
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
  currentWorktreeName,
  currentWorktreePathLabel,
  defaultTarget,
  inputValue,
  repoRoot,
  worktreeDir,
}) {
  const trimmedName = inputValue.trim();
  const fromWorktreeLabel = currentWorktreeName || 'base';
  const fromPathLabel = currentWorktreePathLabel || '.';

  if (!trimmedName) {
    return {
      branchName: defaultTarget.branchName,
      cardTitle: 'Create worktree — random name (type below to customize)',
      fromPathLabel,
      fromWorktreeLabel,
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
    cardTitle: `Create worktree "${trimmedName}" (backspace to clear and use random)`,
    fromPathLabel,
    fromWorktreeLabel,
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

function renderOptionCard({
  details,
  selected,
  tag,
  tagTone,
  title,
  titleTone,
  width,
}) {
  const prefix = selected ? styleText('❯', ANSI.bold, ANSI.cyan) : ' ';
  const titleWidth = Math.max(20, width - 12);
  const titleText = truncateText(title, titleWidth);
  const renderedTitle =
    titleTone || selected
      ? styleText(titleText, selected ? ANSI.bold : '', titleTone || '')
      : titleText;
  const tagPart = tag
    ? `${formatOptionTag(tag, { selected, tone: tagTone })} `
    : '';
  const lines = [`${prefix} ${tagPart}${renderedTitle}`];

  for (const [label, value] of details) {
    lines.push(`    ${formatField(label, value, width - 4, { selected })}`);
  }

  return lines;
}

function renderWorktreeSelector({
  currentWorktreeName,
  currentWorktreePathLabel,
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
    currentWorktreeName,
    currentWorktreePathLabel,
    defaultTarget,
    inputValue,
    repoRoot,
    worktreeDir,
  });
  const optionLines = [
    ...renderOptionCard({
      details: [
        ['Branch', `${createPreview.branchName} (${createPreview.pathLabel})`],
        [
          'From',
          `${createPreview.fromWorktreeLabel} (${createPreview.fromPathLabel})`,
        ],
      ],
      selected: selectedIndex === 0,
      tag: 'NEW',
      tagTone: ANSI.green,
      title: createPreview.cardTitle,
      width,
    }),
    ...worktrees.flatMap((entry, index) => {
      const baseTitle = entry.isBase ? entry.branchName : entry.displayName;
      const prefix = entry.isBase ? '' : getTreePrefix(entry.depth || 0);
      const suffix = entry.isCurrent ? ' *' : '';
      const title = `${prefix}${baseTitle} (${entry.pathLabel})${suffix}`;
      let titleTone = ANSI.green;

      if (entry.isBase) {
        titleTone = ANSI.cyan;
      } else if (entry.isCurrent) {
        titleTone = ANSI.yellow;
      }

      return renderOptionCard({
        details: [],
        selected: selectedIndex === index + 1,
        title,
        titleTone,
        width,
      });
    }),
  ];

  const subtitle = `${styleText('↑/↓', ANSI.bold)} move · ${styleText(
    'Enter',
    ANSI.bold,
  )} confirm · ${styleText('Esc', ANSI.bold)} cancel · type to name`;
  const lines = [
    styleText('Worktree Picker', ANSI.bold, ANSI.cyan),
    subtitle,
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
  currentWorktreeName,
  currentWorktreePathLabel,
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
        currentWorktreeName,
        currentWorktreePathLabel,
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
        resolve({ ...target, parentName: currentWorktreeName });
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
  } else {
    if (selection.mode === 'custom') {
      console.log(`🏷️  Custom name: ${selection.branchName}`);
    } else {
      console.log(`🌍 Random city: ${selection.city}`);
      console.log(`📅 Date: ${selection.date}`);
      console.log(`🔑 Hash: ${selection.hash}`);
    }
    console.log(`🌿 New branch: ${selection.branchName}`);
    if (selection.parentName) {
      console.log(`🧬 Parent worktree: ${selection.parentName}`);
    }
  }

  console.log(`📂 Worktree path: ${selection.worktreePath}`);

  if (commandToRun) {
    console.log(`📝 Command: ${commandToRun}\n`);
  } else {
    console.log('📝 Command: (interactive shell)\n');
  }

  if (stayInWorktreeShell) {
    console.log(
      '🐚 This command keeps you in the selected worktree shell after it exits\n',
    );
  }
}

function openInteractiveShellInWorktree({ shellPath, worktreePath }) {
  console.log('🐚 Starting interactive shell...');
  console.log(`📂 Current directory: ${worktreePath}`);
  console.log('↩️  Exit this shell to return to the original terminal.\n');
  execFileSync(shellPath, ['-i'], {
    cwd: worktreePath,
    stdio: 'inherit',
  });
}

function runWorktreeCommand({ commandArgs, commandToRun, selection }) {
  const currentBranch = getCurrentBranch();
  const shellPath = process.env.SHELL || '/bin/zsh';
  const isShellOnly = commandArgs.length === 0;
  const stayInWorktreeShell =
    !isShellOnly && shouldStayInWorktreeShell(commandArgs);

  logWorktreeSelection({
    commandToRun: isShellOnly ? null : commandToRun,
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

      recordCreatedWorktreeMetadata({
        branchName: selection.branchName,
        createdFromBranch: currentBranch,
        displayName: path.basename(selection.worktreePath),
        parentName: selection.parentName || null,
      });

      console.log('\n✅ Worktree created successfully!');
      console.log(`📂 Changed directory to: ${selection.worktreePath}`);
    } else {
      console.log('✅ Using existing worktree');
      console.log(`📂 Changed directory to: ${selection.worktreePath}`);
    }

    if (isShellOnly) {
      console.log('\n🚀 Entering this worktree...\n');
    } else {
      console.log('\n🚀 Running command in this worktree...\n');
    }

    try {
      process.chdir(selection.worktreePath);
      if (isShellOnly) {
        openInteractiveShellInWorktree({
          shellPath,
          worktreePath: selection.worktreePath,
        });
      } else {
        runCommandInWorktree({
          commandToRun,
          shellPath,
          stayInWorktreeShell,
          worktreePath: selection.worktreePath,
        });
      }
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
  const currentWorktreeName = getCurrentWorktreeName(
    repoRoot,
    currentTopLevelPath,
  );

  if (!fs.existsSync(worktreeDir)) {
    fs.mkdirSync(worktreeDir, { recursive: true });
  }

  const gitCommonDir = getGitCommonDir();
  const metadataFilePath = getMetadataFilePath(gitCommonDir);
  const existingWorktrees = getExistingWorktrees(repoRoot, currentTopLevelPath);
  const metadata = readMetadata(metadataFilePath);
  const syncedMetadata = syncMetadataWithExistingWorktrees(
    metadata,
    existingWorktrees,
  );

  if (!metadataEquals(metadata, syncedMetadata)) {
    writeMetadata(metadataFilePath, syncedMetadata);
  }

  if (customName) {
    return {
      ...getCustomWorktreeTarget(worktreeDir, customName),
      parentName: currentWorktreeName,
    };
  }

  const defaultTarget = {
    ...getAutoCreateTarget(worktreeDir),
    parentName: currentWorktreeName,
  };
  const orderedWorktrees = buildWorktreeTreeOrder(
    existingWorktrees,
    syncedMetadata,
  );
  const currentWorktreePathLabel = getWorktreePathLabel(
    repoRoot,
    currentTopLevelPath,
  );

  return selectWorktreeTarget({
    currentWorktreeName,
    currentWorktreePathLabel,
    defaultTarget,
    repoRoot,
    worktreeDir,
    worktrees: orderedWorktrees,
  });
}

function showHelp() {
  console.log(`
Usage: yarn worktree [-n <name> | --name <name>] [--] [command...]

Opens an interactive picker to create a new worktree or jump into an existing
one. Existing worktrees are rendered as a tree based on parent-child
relationships (see metadata below).

- No command: drops you into an interactive shell inside the selected worktree.
- With command: runs the command in the selected worktree. For 'codex' / 'claude'
  the shell stays alive after the command exits.
- -n/--name <name>: skip the picker and create a worktree with the given name.
- Auto-generated names: {city}-{MMDD}-{hash4}, e.g. 'london-0423-a1b2'.
- Metadata: recorded at <gitCommonDir>/${METADATA_FILE_NAME} (shared by all
  worktrees). Pre-existing worktrees are auto-registered as orphans.

Examples (quotes optional):
  yarn worktree                    # Pick a worktree, drop into its shell
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

  if (parsedArgs.showHelp) {
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
