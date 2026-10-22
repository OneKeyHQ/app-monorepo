/* cspell:words GOMEMLIMIT tsgolint */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exit } = require('process');

const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '../..');
const OXLINT_CONFIG_PATH = path.join(ROOT_DIR, '.oxlintrc.json');
const TYPE_AWARE_TMP_CONFIG_NAME = '.oxlintrc.type-aware.tmp.json';
const TYPE_AWARE_TMP_CONFIG_PATH = path.join(
  ROOT_DIR,
  TYPE_AWARE_TMP_CONFIG_NAME,
);
const DEFAULT_TSGOLINT_GOMEMLIMIT = '6GiB';

const getTimestamp = () => new Date().toLocaleTimeString();

function resolvePackageBinary(packageName, rootDir = ROOT_DIR) {
  const manifestPath = require.resolve(`${packageName}/package.json`, {
    paths: [rootDir],
  });
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
  const parsed = ts.parseConfigFileTextToJson(configPath, rawConfig);
  if (parsed.error) {
    const message = ts.flattenDiagnosticMessageText(
      parsed.error.messageText,
      '\n',
    );
    throw new Error(`Failed to parse ${configPath}: ${message}`);
  }
  return parsed.config;
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

function runOxlintPass({ oxlintBin, args, env }) {
  const result = execFileSync(process.execPath, [oxlintBin, ...args], {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    stdio: 'pipe',
    env,
  });
  const { warnings, errors } = parseOxlintCounts(result);
  return { output: result, warnings, errors };
}

function removeTempTypeAwareConfig(configPath = TYPE_AWARE_TMP_CONFIG_PATH) {
  try {
    fs.unlinkSync(configPath);
  } catch {
    // Ignore when already removed.
  }
}

function main() {
  // Detect CI environment - most CI platforms set CI=true
  const isCI = Boolean(process.env.CI);

  console.log(`[${getTimestamp()}] Lint check started...`);

  // ============================================
  // Run Oxlint in two sequential passes so the ~6.8 GB V8 + jsPlugins heap and
  // the ~7-10 GB tsgolint Go process never overlap in memory on 16 GB CI runners.
  // ============================================
  console.log(`[${getTimestamp()}] Oxlint check started...`);
  const oxlintStartTime = Date.now();

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

    // Pass 1: Standard native rules + JS plugins without spawning tsgolint.
    const standardStartTime = Date.now();
    const standardPass = runOxlintPass({
      oxlintBin,
      args: [
        '--tsconfig',
        './tsconfig.json',
        '--deny-warnings',
        `--threads=${cpus}`,
        '.',
        ...fixArgs,
      ],
      env: process.env,
    });
    const standardDuration = ((Date.now() - standardStartTime) / 1000).toFixed(
      2,
    );

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

    // Pass 2: Type-aware rules via tsgolint with jsPlugins stripped so the Node
    // host process stays under ~650 MB RSS while tsgolint runs.
    const rawConfig = fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8');
    const typeAwareConfig = createTypeAwareOxlintConfig(
      parseOxlintConfig(rawConfig),
    );
    fs.writeFileSync(
      TYPE_AWARE_TMP_CONFIG_PATH,
      `${JSON.stringify(typeAwareConfig, null, 2)}\n`,
    );

    const cleanupOnSignal = () => {
      removeTempTypeAwareConfig();
    };
    process.once('exit', cleanupOnSignal);
    process.once('SIGINT', cleanupOnSignal);
    process.once('SIGTERM', cleanupOnSignal);

    try {
      const typeAwareStartTime = Date.now();
      const typeAwarePass = runOxlintPass({
        oxlintBin,
        args: [
          '-c',
          `./${TYPE_AWARE_TMP_CONFIG_NAME}`,
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
      });
      const typeAwareDuration = (
        (Date.now() - typeAwareStartTime) /
        1000
      ).toFixed(2);

      if (typeAwarePass.errors > 0 || typeAwarePass.warnings > 0) {
        console.log(typeAwarePass.output);
        const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(
          2,
        );
        console.log(
          `[${getTimestamp()}] Oxlint check failed with ${typeAwarePass.errors} error(s) and ${typeAwarePass.warnings} warning(s). (${oxlintDuration}s)`,
        );
        exit(1);
      }

      console.log(
        `[${getTimestamp()}] Oxlint type-aware pass completed. (${typeAwareDuration}s)`,
      );
    } finally {
      process.removeListener('exit', cleanupOnSignal);
      process.removeListener('SIGINT', cleanupOnSignal);
      process.removeListener('SIGTERM', cleanupOnSignal);
      removeTempTypeAwareConfig();
    }

    const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(2);
    console.log(
      `[${getTimestamp()}] Oxlint check passed. (${oxlintDuration}s)`,
    );
  } catch (error) {
    removeTempTypeAwareConfig();
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
    execFileSync(process.execPath, [oxfmtBin, ...oxfmtArgs], {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const oxfmtDuration = ((Date.now() - oxfmtStartTime) / 1000).toFixed(2);
    console.log(`[${getTimestamp()}] Oxfmt check passed. (${oxfmtDuration}s)`);
  } catch (error) {
    const oxfmtDuration = ((Date.now() - oxfmtStartTime) / 1000).toFixed(2);
    if (error.stdout) {
      console.log(error.stdout.toString('utf-8'));
    }
    if (error.stderr) {
      console.error(error.stderr.toString('utf-8'));
    }
    console.log(`[${getTimestamp()}] Oxfmt check failed. (${oxfmtDuration}s)`);
    exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  OXLINT_CONFIG_PATH,
  createTypeAwareOxlintConfig,
  getJsPluginRulePrefix,
  parseOxlintConfig,
  parseOxlintCounts,
  stripJsPluginRules,
};
