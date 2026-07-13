const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const lodash = require('lodash');
const prettier = require('prettier');

const base = path.resolve(__dirname, './react');
const dirs = fs.readdirSync(base);

const pascalCase = (str) =>
  lodash.camelCase(str).replace(/^(.)/, lodash.toUpper);

const items = [];

dirs.forEach((dir) => {
  if (dir !== '.DS_Store') {
    const files = fs.readdirSync(path.resolve(base, `${dir}`));
    files
      .filter((item) => !item.includes('index'))
      .forEach((file) => {
        const basicName = path.basename(file, path.extname(file));
        if (!basicName.toLowerCase().includes('.ds_store')) {
          items.push({
            symbol: pascalCase(`${basicName}${dir.toUpperCase()}`),
            path: `${dir}/${basicName}`,
            name: pascalCase(`${basicName}${dir.toUpperCase()}`),
          });
        }
      });
  }
});

const typesTemplate = `
/* eslint-disable */
  import { I18nManager } from "react-native";

  const icons = {
    ${items
      .map((item) => {
        if (item.symbol.includes('Left')) {
          const rightSymbol = item.symbol.replace('Left', 'Right');
          const rightItem = items.find((i) => i.symbol === rightSymbol);
          if (rightItem) {
            return `${item.symbol}: () => I18nManager.isRTL ? import('./react/${rightItem.path}') : import('./react/${item.path}')`;
          }
        }
        if (item.symbol.includes('Right')) {
          const leftSymbol = item.symbol.replace('Right', 'Left');
          const leftItem = items.find((i) => i.symbol === leftSymbol);
          if (leftItem) {
            return `${item.symbol}: () => I18nManager.isRTL ? import('./react/${leftItem.path}') : import('./react/${item.path}')`;
          }
        }
        return `${item.symbol}: () => import('./react/${item.path}')`;
      })
      .join(',')}
  }
  export type IKeyOfIcons = keyof typeof icons;
  export default icons;
`;

const iconsFilePath = path.resolve(__dirname, './Icons.tsx');
const repoRoot = path.resolve(__dirname, '../../../../..');
const iconsRepoRelativePath = path.relative(repoRoot, iconsFilePath);

// Baseline = git HEAD's Icons.tsx, not the on-disk version. The on-disk file
// is overwritten on every build, so a single bad run would otherwise become
// the new baseline and silently mask further regressions.
const readCommittedIconsSource = () => {
  try {
    return execFileSync('git', ['show', `HEAD:${iconsRepoRelativePath}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const extractIconSymbols = (source) => {
  const set = new Set();
  for (const match of source.matchAll(
    /^\s*([A-Z][A-Za-z0-9]*)\s*:\s*\(\)\s*=>/gm,
  )) {
    set.add(match[1]);
  }
  return set;
};

prettier.format(typesTemplate, { parser: 'typescript' }).then((formatted) => {
  fs.writeFileSync(iconsFilePath, formatted, 'utf8');

  const committedSource = readCommittedIconsSource();
  if (!committedSource) return;

  const committed = extractIconSymbols(committedSource);
  const current = extractIconSymbols(formatted);
  const missing = [...committed].filter((symbol) => !current.has(symbol));
  if (missing.length === 0) return;

  if (process.env.ICON_BUILD_ALLOW_REMOVALS === '1') {
    console.warn(
      `[icon:build] ICON_BUILD_ALLOW_REMOVALS=1 — allowing removal of ${missing.length} icon(s): ${missing.join(', ')}`,
    );
    return;
  }

  console.error(
    [
      '',
      `✗ [icon:build] ${missing.length} icon(s) present in committed Icons.tsx are missing after rebuild:`,
      ...missing.map((symbol) => `    - ${symbol}`),
      '',
      'Likely cause: a hand-written .tsx in src/primitives/Icon/react/ had no',
      'matching SVG source under packages/components/svg/<dir>/<name>.svg, so',
      'rimraf wiped it and svgr could not regenerate it.',
      '',
      'Fix: add the missing SVG source(s) so svgr produces the .tsx, e.g.',
      '  packages/components/svg/colored/user-avatar-fallback.svg',
      '  packages/components/svg/illus/bot.svg',
      '',
      'If the removal is intentional, re-run with:',
      '  ICON_BUILD_ALLOW_REMOVALS=1 yarn icon:build',
      '',
    ].join('\n'),
  );
  process.exit(1);
});
