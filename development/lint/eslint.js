/* cspell:words GOMEMLIMIT tsgolint */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exit } = require('process');

const { parse: parseJsonc, printParseErrorCode } = require('jsonc-parser');

const { splitArgumentsByLength } = require('../scripts/command-batches');

const ROOT_DIR = path.resolve(__dirname, '../..');
const OXLINT_CONFIG_PATH = path.join(ROOT_DIR, '.oxlintrc.json');
const DEFAULT_TSGOLINT_GOMEMLIMIT = '11GiB';
const OXLINT_PASS_ENV = 'ONEKEY_OXLINT_PASS';
// Git revision to diff against. When set, the spellchecker only runs on files
// changed since that revision; every other rule still lints the whole repo.
const CSPELL_DIFF_BASE_ENV = 'ONEKEY_CSPELL_DIFF_BASE';
const CSPELL_RULE_PREFIX = '@cspell/';
// Extensions oxlint lints by default.
const OXLINT_TARGET_FILE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
// The spellchecker result for a file depends only on that file, the cspell
// configuration and dictionaries, the oxlint rule options, and the installed
// plugin and dictionary versions. A change to any of these can alter results
// for unchanged files, so it forces a full scan.
const CSPELL_FULL_SCAN_FILES = new Set([
  '.oxlintrc.json',
  'development/spellCheckerSkipWords.txt',
  'development/lint/eslint.js',
  'yarn.lock',
]);
// CSpell also searches every directory for config files (any case, such as
// cSpell.json, including TypeScript configs) and the `cspell` field of any
// package.json, so every manifest counts as a config file.
const CSPELL_CONFIG_FILE_RE =
  /(?:^|\/)(?:package\.json|\.?cspell[^/]*\.(?:jsonc?|ya?ml|[cm]?js|toml)|\.?cspell\.config\.[cm]?ts)$/iu;

const getTimestamp = () => new Date().toLocaleTimeString();

function getTempTypeAwareConfigName(pid = process.pid) {
  return `.oxlintrc.type-aware.${pid}.tmp.json`;
}

function getTempTypeAwareConfigPath(rootDir = ROOT_DIR, pid = process.pid) {
  return path.join(rootDir, getTempTypeAwareConfigName(pid));
}

function getTempCspellConfigNames(pid = process.pid) {
  return {
    withoutCspell: `.oxlintrc.no-cspell.${pid}.tmp.json`,
    cspellOnly: `.oxlintrc.cspell.${pid}.tmp.json`,
  };
}

function getSignalExitCode(signal) {
  if (signal === 'SIGINT') {
    return 130;
  }
  if (signal === 'SIGTERM') {
    return 143;
  }
  return 1;
}

function findPackageManifestPath(packageName, rootDir = ROOT_DIR) {
  const directManifestPath = path.join(
    rootDir,
    'node_modules',
    packageName,
    'package.json',
  );
  if (fs.existsSync(directManifestPath)) {
    return directManifestPath;
  }

  let currentDir = path.dirname(
    require.resolve(packageName, { paths: [rootDir] }),
  );
  while (true) {
    const candidatePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(candidatePath)) {
      const manifest = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
      if (manifest.name === packageName) {
        return candidatePath;
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  throw new Error(`Unable to locate package.json for package: ${packageName}`);
}

function resolvePackageBinary(packageName, rootDir = ROOT_DIR) {
  if (process.platform !== 'win32') {
    const dotBinPath = path.join(rootDir, 'node_modules', '.bin', packageName);
    if (fs.existsSync(dotBinPath)) {
      return fs.realpathSync(dotBinPath);
    }
  }

  const manifestPath = findPackageManifestPath(packageName, rootDir);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const relativeBinPath =
    typeof manifest.bin === 'string'
      ? manifest.bin
      : manifest.bin &&
        (manifest.bin[packageName] || Object.values(manifest.bin)[0]);

  if (!relativeBinPath) {
    throw new Error(`Unable to resolve binary for package: ${packageName}`);
  }

  return path.resolve(path.dirname(manifestPath), relativeBinPath);
}

function getJsPluginRulePrefix(pluginEntry) {
  if (pluginEntry && typeof pluginEntry === 'object' && pluginEntry.name) {
    return `${pluginEntry.name}/`;
  }
  if (typeof pluginEntry === 'string') {
    const baseName = path.basename(pluginEntry, path.extname(pluginEntry));
    const pluginName = baseName.replace(/^eslint-plugin-/u, '');
    return `${pluginName}/`;
  }
  throw new Error(
    `Unsupported oxlint jsPlugin entry: ${JSON.stringify(pluginEntry)}`,
  );
}

function stripJsPluginRules(rules, prefixes) {
  if (!rules || typeof rules !== 'object') {
    return rules;
  }
  return Object.fromEntries(
    Object.entries(rules).filter(
      ([ruleName]) => !prefixes.some((prefix) => ruleName.startsWith(prefix)),
    ),
  );
}

function parseOxlintConfig(rawConfig, configPath = OXLINT_CONFIG_PATH) {
  const errors = [];
  const config = parseJsonc(rawConfig, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const [firstError] = errors;
    throw new Error(
      `Failed to parse ${configPath}: ${printParseErrorCode(
        firstError.error,
      )} (offset ${firstError.offset})`,
    );
  }
  return config;
}

function createTypeAwareOxlintConfig(config) {
  const prefixes = (config.jsPlugins ?? []).map(getJsPluginRulePrefix);
  const nextConfig = {
    ...config,
    jsPlugins: [],
    rules: stripJsPluginRules(config.rules, prefixes),
  };

  if (Array.isArray(config.overrides)) {
    nextConfig.overrides = config.overrides.map((override) => ({
      ...override,
      ...(override.rules
        ? { rules: stripJsPluginRules(override.rules, prefixes) }
        : {}),
    }));
  }

  return nextConfig;
}

function parseOxlintCounts(output) {
  // Example output: "Found 33 warnings and 0 errors."
  const warningMatch = output.match(/Found (\d+) warning/u);
  const errorMatch = output.match(/(\d+) error/u);
  return {
    warnings: warningMatch ? Number(warningMatch[1]) : 0,
    errors: errorMatch ? Number(errorMatch[1]) : 0,
  };
}

function spawnNodeBinary({ binPath, args, env = process.env, onChild }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: ROOT_DIR,
      detached: process.platform !== 'win32',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (onChild) {
      onChild(child);
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('error', (error) => {
      if (onChild) {
        onChild(null);
      }
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (onChild) {
        onChild(null);
      }
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(
        `Command failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`,
      );
      error.status = code;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function runOxlintPass({ oxlintBin, args, env, onChild }) {
  const { stdout } = await spawnNodeBinary({
    binPath: oxlintBin,
    args,
    env,
    onChild,
  });
  const { warnings, errors } = parseOxlintCounts(stdout);
  return { output: stdout, warnings, errors };
}

function removeTempTypeAwareConfig(configPath) {
  const configPaths = Array.isArray(configPath) ? configPath : [configPath];
  for (const item of configPaths.filter(Boolean)) {
    try {
      fs.unlinkSync(item);
    } catch {
      // Ignore when already removed.
    }
  }
}

function isCspellPlugin(pluginEntry) {
  return getJsPluginRulePrefix(pluginEntry) === CSPELL_RULE_PREFIX;
}

function pickCspellRules(rules) {
  if (!rules || typeof rules !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(rules).filter(([ruleName]) =>
      ruleName.startsWith(CSPELL_RULE_PREFIX),
    ),
  );
}

function hasCspellPlugin(config) {
  return (config.jsPlugins ?? []).some(isCspellPlugin);
}

// Same config minus the spellchecker plugin and its rules.
function createOxlintConfigWithoutCspell(config) {
  const nextConfig = {
    ...config,
    jsPlugins: (config.jsPlugins ?? []).filter(
      (pluginEntry) => !isCspellPlugin(pluginEntry),
    ),
    rules: stripJsPluginRules(config.rules, [CSPELL_RULE_PREFIX]),
  };
  if (Array.isArray(config.overrides)) {
    nextConfig.overrides = config.overrides.map((override) => ({
      ...override,
      ...(override.rules
        ? {
            rules: stripJsPluginRules(override.rules, [CSPELL_RULE_PREFIX]),
          }
        : {}),
    }));
  }
  return nextConfig;
}

// Only the spellchecker: every native category and plugin is off, so this
// pass reports exactly what the spellchecker reports in the full config.
function createCspellOnlyOxlintConfig(config) {
  const categories = Object.fromEntries(
    Object.keys(config.categories ?? {}).map((category) => [category, 'off']),
  );
  const nextConfig = {
    ...config,
    jsPlugins: (config.jsPlugins ?? []).filter(isCspellPlugin),
    plugins: [],
    categories: {
      correctness: 'off',
      suspicious: 'off',
      pedantic: 'off',
      perf: 'off',
      style: 'off',
      restriction: 'off',
      nursery: 'off',
      ...categories,
    },
    rules: pickCspellRules(config.rules),
  };
  if (Array.isArray(config.overrides)) {
    nextConfig.overrides = config.overrides
      .map((override) => ({
        ...override,
        rules: pickCspellRules(override.rules),
      }))
      .filter((override) => Object.keys(override.rules).length > 0);
  }
  return nextConfig;
}

function filterOxlintTargetFiles(files) {
  return files.filter((file) => OXLINT_TARGET_FILE_RE.test(file));
}

function getCspellFullScanReason(changedFiles) {
  const trigger = changedFiles.find(
    (file) =>
      CSPELL_FULL_SCAN_FILES.has(file) || CSPELL_CONFIG_FILE_RE.test(file),
  );
  return trigger ? `${trigger} changed` : null;
}

// Every path touched since `base`, including deleted files and both sides of
// a rename, so removing a full-scan trigger (such as the dictionary) is seen.
function listChangedFiles(base, rootDir = ROOT_DIR) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', base, 'HEAD', '--'],
    { cwd: rootDir, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 },
  );
  return output.split('\0').filter(Boolean);
}

function fileExistsInRoot(file, rootDir = ROOT_DIR) {
  return fs.existsSync(path.join(rootDir, file));
}

// Decides whether the spellchecker runs on the whole repo or only on the
// files changed since `base`. Anything unexpected falls back to a full scan.
function resolveCspellScope({
  base,
  config,
  getChangedFiles = listChangedFiles,
  fileExists = fileExistsInRoot,
}) {
  if (!base) {
    return { mode: 'full', reason: `${CSPELL_DIFF_BASE_ENV} is not set` };
  }
  if (!hasCspellPlugin(config)) {
    return { mode: 'full', reason: 'the spellchecker plugin is not enabled' };
  }
  let changedFiles;
  try {
    changedFiles = getChangedFiles(base);
  } catch (error) {
    return {
      mode: 'full',
      reason: `cannot diff against ${base}: ${error.message.split('\n')[0]}`,
    };
  }
  // Full-scan triggers are checked against every touched path, deletions
  // included; only files that still exist are spellchecked incrementally.
  const reason = getCspellFullScanReason(changedFiles);
  if (reason) {
    return { mode: 'full', reason };
  }
  return {
    mode: 'changed',
    files: filterOxlintTargetFiles(changedFiles).filter((file) =>
      fileExists(file),
    ),
  };
}

function terminateChildProcess({
  child,
  signal,
  killProcess = process.kill.bind(process),
}) {
  if (!child || child.killed) {
    return;
  }
  if (process.platform !== 'win32' && typeof child.pid === 'number') {
    try {
      // Kill the entire process group (-pid) so child processes spawned by
      // oxlint (such as tsgolint headless) are terminated together.
      killProcess(-child.pid, signal);
      return;
    } catch {
      // Fall back to direct child kill if process group lookup fails.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Ignore if child already exited.
  }
}

function createSignalCleanupHandler({
  tempConfigPath,
  getActiveChild,
  killProcess = process.kill.bind(process),
  exitProcess = exit,
}) {
  return (signal) => {
    const activeChild = getActiveChild ? getActiveChild() : null;
    terminateChildProcess({ child: activeChild, signal, killProcess });
    removeTempTypeAwareConfig(tempConfigPath);
    exitProcess(getSignalExitCode(signal));
  };
}

// CI runs the type-aware pass in a separate job so it can overlap with tsc and
// the standard pass on another runner; local runs keep the full sequence.
function resolveLintPasses(value) {
  if (!value || value === 'all') {
    return { standard: true, typeAware: true, format: true };
  }
  if (value === 'standard') {
    return { standard: true, typeAware: false, format: true };
  }
  if (value === 'type-aware') {
    return { standard: false, typeAware: true, format: false };
  }
  throw new Error(
    `Unsupported ${OXLINT_PASS_ENV} value: ${value} (expected all, standard, or type-aware)`,
  );
}

async function main() {
  // Detect CI environment - most CI platforms set CI=true
  const isCI = Boolean(process.env.CI);

  let passes;
  try {
    passes = resolveLintPasses(process.env[OXLINT_PASS_ENV]);
  } catch (error) {
    console.error(error.message);
    exit(1);
  }

  console.log(`[${getTimestamp()}] Lint check started...`);

  // ============================================
  // Run Oxlint in two sequential passes so the ~6.8 GB V8 + jsPlugins heap and
  // the ~7-10 GB tsgolint Go process never overlap in memory on 16 GB CI runners.
  // ============================================
  console.log(`[${getTimestamp()}] Oxlint check started...`);
  const oxlintStartTime = Date.now();
  const tempConfigName = getTempTypeAwareConfigName(process.pid);
  const tempConfigPath = getTempTypeAwareConfigPath(ROOT_DIR, process.pid);
  const cspellConfigNames = getTempCspellConfigNames(process.pid);
  const allTempConfigPaths = [
    tempConfigPath,
    path.join(ROOT_DIR, cspellConfigNames.withoutCspell),
    path.join(ROOT_DIR, cspellConfigNames.cspellOnly),
  ];
  let activeChild = null;
  const setActiveChild = (child) => {
    activeChild = child;
  };
  const cleanupOnExit = () => {
    removeTempTypeAwareConfig(allTempConfigPaths);
  };
  const cleanupOnSignal = createSignalCleanupHandler({
    tempConfigPath: allTempConfigPaths,
    getActiveChild: () => activeChild,
  });

  process.once('exit', cleanupOnExit);
  process.once('SIGINT', cleanupOnSignal);
  process.once('SIGTERM', cleanupOnSignal);

  try {
    const cpus =
      process.platform === 'darwin'
        ? Math.min(os.cpus().length, 4)
        : os.cpus().length;
    const fixArgs = isCI ? [] : ['--fix'];
    const oxlintBin = resolvePackageBinary('oxlint');

    console.log(
      `Using ${cpus} threads for oxlint...${isCI ? ' (CI mode, no --fix)' : ''}`,
    );

    if (passes.standard) {
      // Pass 1: Standard native rules + JS plugins without spawning tsgolint.
      const standardStartTime = Date.now();
      const baseArgs = [
        '--tsconfig',
        './tsconfig.json',
        '--deny-warnings',
        `--threads=${cpus}`,
      ];
      const parsedConfig = parseOxlintConfig(
        fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8'),
      );
      const cspellScope = resolveCspellScope({
        base: process.env[CSPELL_DIFF_BASE_ENV],
        config: parsedConfig,
      });
      let standardPass;
      if (cspellScope.mode === 'full') {
        if (process.env[CSPELL_DIFF_BASE_ENV]) {
          console.log(
            `[${getTimestamp()}] Spellchecker runs on all files: ${cspellScope.reason}.`,
          );
        }
        standardPass = await runOxlintPass({
          oxlintBin,
          args: [...baseArgs, '.', ...fixArgs],
          env: process.env,
          onChild: setActiveChild,
        });
      } else {
        // The spellchecker is the slowest rule by far and only reads the
        // file it checks, so it runs on changed files while every other rule
        // still covers the whole repo.
        const [withoutCspellPath, cspellOnlyPath] = allTempConfigPaths.slice(1);
        fs.writeFileSync(
          withoutCspellPath,
          `${JSON.stringify(createOxlintConfigWithoutCspell(parsedConfig), null, 2)}\n`,
        );
        fs.writeFileSync(
          cspellOnlyPath,
          `${JSON.stringify(createCspellOnlyOxlintConfig(parsedConfig), null, 2)}\n`,
        );
        try {
          const restPass = await runOxlintPass({
            oxlintBin,
            args: [
              '-c',
              `./${cspellConfigNames.withoutCspell}`,
              ...baseArgs,
              '.',
              ...fixArgs,
            ],
            env: process.env,
            onChild: setActiveChild,
          });
          const restDuration = (
            (Date.now() - standardStartTime) /
            1000
          ).toFixed(2);
          console.log(
            `[${getTimestamp()}] Oxlint pass without the spellchecker completed on all files. (${restDuration}s)`,
          );

          const cspellStartTime = Date.now();
          const cspellFixedArgs = [
            '-c',
            `./${cspellConfigNames.cspellOnly}`,
            ...baseArgs,
            // Changed files may all match ignorePatterns.
            '--no-error-on-unmatched-pattern',
            ...fixArgs,
          ];
          const batches = splitArgumentsByLength({
            command: oxlintBin,
            fixedArgs: cspellFixedArgs,
            values: cspellScope.files,
          });
          const cspellPasses = [];
          for (const batch of batches) {
            cspellPasses.push(
              await runOxlintPass({
                oxlintBin,
                args: [...cspellFixedArgs, ...batch],
                env: process.env,
                onChild: setActiveChild,
              }),
            );
          }
          const cspellDuration = (
            (Date.now() - cspellStartTime) /
            1000
          ).toFixed(2);
          console.log(
            `[${getTimestamp()}] Spellchecker completed on ${cspellScope.files.length} changed file(s) since ${process.env[CSPELL_DIFF_BASE_ENV]}. (${cspellDuration}s)`,
          );

          standardPass = [restPass, ...cspellPasses].reduce(
            (total, pass) => ({
              output: [total.output, pass.output].filter(Boolean).join('\n'),
              warnings: total.warnings + pass.warnings,
              errors: total.errors + pass.errors,
            }),
            { output: '', warnings: 0, errors: 0 },
          );
        } finally {
          removeTempTypeAwareConfig([withoutCspellPath, cspellOnlyPath]);
        }
      }
      const standardDuration = (
        (Date.now() - standardStartTime) /
        1000
      ).toFixed(2);

      if (standardPass.errors > 0 || standardPass.warnings > 0) {
        console.log(standardPass.output);
        console.log(
          `[${getTimestamp()}] Oxlint check failed with ${standardPass.errors} error(s) and ${standardPass.warnings} warning(s). (${standardDuration}s)`,
        );
        exit(1);
      }

      console.log(
        `[${getTimestamp()}] Oxlint standard + JS plugins pass completed. (${standardDuration}s)`,
      );
    }

    if (passes.typeAware) {
      // Pass 2: Type-aware rules via tsgolint with jsPlugins stripped so the Node
      // host process stays under ~650 MB RSS while tsgolint runs.
      const rawConfig = fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8');
      const typeAwareConfig = createTypeAwareOxlintConfig(
        parseOxlintConfig(rawConfig),
      );
      fs.writeFileSync(
        tempConfigPath,
        `${JSON.stringify(typeAwareConfig, null, 2)}\n`,
      );

      try {
        const typeAwareStartTime = Date.now();
        const typeAwarePass = await runOxlintPass({
          oxlintBin,
          args: [
            '-c',
            `./${tempConfigName}`,
            '--tsconfig',
            './tsconfig.json',
            '--type-aware',
            '--deny-warnings',
            `--threads=${cpus}`,
            '.',
            ...fixArgs,
          ],
          env: {
            ...process.env,
            GOMEMLIMIT: process.env.GOMEMLIMIT || DEFAULT_TSGOLINT_GOMEMLIMIT,
          },
          onChild: setActiveChild,
        });
        const typeAwareDuration = (
          (Date.now() - typeAwareStartTime) /
          1000
        ).toFixed(2);

        if (typeAwarePass.errors > 0 || typeAwarePass.warnings > 0) {
          console.log(typeAwarePass.output);
          const oxlintDuration = (
            (Date.now() - oxlintStartTime) /
            1000
          ).toFixed(2);
          console.log(
            `[${getTimestamp()}] Oxlint check failed with ${typeAwarePass.errors} error(s) and ${typeAwarePass.warnings} warning(s). (${oxlintDuration}s)`,
          );
          exit(1);
        }

        console.log(
          `[${getTimestamp()}] Oxlint type-aware pass completed. (${typeAwareDuration}s)`,
        );
      } finally {
        removeTempTypeAwareConfig(tempConfigPath);
      }
    }

    const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(2);
    console.log(
      `[${getTimestamp()}] Oxlint check passed. (${oxlintDuration}s)`,
    );
  } catch (error) {
    removeTempTypeAwareConfig(allTempConfigPaths);
    const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(2);
    if (error.stdout) {
      console.log(error.stdout.toString('utf-8'));
    }
    if (error.stderr) {
      console.error(error.stderr.toString('utf-8'));
    }
    console.log(
      `[${getTimestamp()}] Oxlint check failed. (${oxlintDuration}s)`,
    );
    exit(1);
  }

  if (passes.format) {
    // ============================================
    // Run Oxfmt separately from lint rules
    // ============================================
    console.log(`[${getTimestamp()}] Oxfmt check started...`);
    const oxfmtStartTime = Date.now();

    try {
      const oxfmtBin = resolvePackageBinary('oxfmt');
      const oxfmtArgs = [
        ...(isCI ? ['--check'] : []),
        '**/*.{js,jsx,ts,tsx,mjs,cjs}',
      ];
      await spawnNodeBinary({
        binPath: oxfmtBin,
        args: oxfmtArgs,
        onChild: setActiveChild,
      });
      const oxfmtDuration = ((Date.now() - oxfmtStartTime) / 1000).toFixed(2);
      console.log(
        `[${getTimestamp()}] Oxfmt check passed. (${oxfmtDuration}s)`,
      );
    } catch (error) {
      const oxfmtDuration = ((Date.now() - oxfmtStartTime) / 1000).toFixed(2);
      if (error.stdout) {
        console.log(error.stdout.toString('utf-8'));
      }
      if (error.stderr) {
        console.error(error.stderr.toString('utf-8'));
      }
      console.log(
        `[${getTimestamp()}] Oxfmt check failed. (${oxfmtDuration}s)`,
      );
      exit(1);
    } finally {
      process.removeListener('exit', cleanupOnExit);
      process.removeListener('SIGINT', cleanupOnSignal);
      process.removeListener('SIGTERM', cleanupOnSignal);
    }
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  OXLINT_CONFIG_PATH,
  createCspellOnlyOxlintConfig,
  createOxlintConfigWithoutCspell,
  createSignalCleanupHandler,
  createTypeAwareOxlintConfig,
  filterOxlintTargetFiles,
  findPackageManifestPath,
  getCspellFullScanReason,
  getJsPluginRulePrefix,
  getSignalExitCode,
  getTempCspellConfigNames,
  getTempTypeAwareConfigName,
  getTempTypeAwareConfigPath,
  listChangedFiles,
  parseOxlintConfig,
  parseOxlintCounts,
  resolveCspellScope,
  resolveLintPasses,
  resolvePackageBinary,
  stripJsPluginRules,
};
