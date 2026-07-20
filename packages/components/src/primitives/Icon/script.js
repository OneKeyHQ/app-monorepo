const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { transform } = require('@svgr/core');
const svgrJsx = require('@svgr/plugin-jsx');
const svgrSvgo = require('@svgr/plugin-svgo');
const lodash = require('lodash');

const repoRoot = path.resolve(__dirname, '../../../../..');
const componentsRoot = path.resolve(__dirname, '../../..');
const svgRoot = path.join(componentsRoot, 'svg');
const generatedRoot = path.resolve(__dirname, './react');
const iconsFilePath = path.resolve(__dirname, './Icons.tsx');
const svgrConfigPath = path.join(componentsRoot, '.svgrrc.json');

const FORMAT_OPTIONS = {
  printWidth: 80,
  quoteProps: 'preserve',
  singleQuote: true,
  trailingComma: 'all',
};
const DYNAMIC_ID_ICONS = new Set([
  'colored/OnekeyPrimeDark.tsx',
  'colored/OnekeyPrimeLight.tsx',
]);

const pascalCase = (value) =>
  lodash.camelCase(value).replace(/^(.)/, lodash.toUpper);

const compareStrings = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const readCommittedIconsSource = () => {
  const iconsRepoRelativePath = path
    .relative(repoRoot, iconsFilePath)
    .split(path.sep)
    .join('/');
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
  const symbols = new Set();
  for (const match of source.matchAll(
    /^\s*([A-Z][A-Za-z0-9]*)\s*:\s*\(\)\s*=>/gm,
  )) {
    symbols.add(match[1]);
  }
  return symbols;
};

const extractIconSymbolOrder = (source) =>
  [...source.matchAll(/^\s*([A-Z][A-Za-z0-9]*)\s*:\s*\(\)\s*=>/gm)].map(
    (match) => match[1],
  );

function applyGeneratedIconOverrides(relativePath, source) {
  if (!DYNAMIC_ID_ICONS.has(relativePath)) return source;

  const id = source.match(/id="([^"]+)"/)?.[1];
  if (!id || !source.includes(`url(#${id})`)) {
    throw new TypeError(`Expected one SVG definition ID in ${relativePath}`);
  }
  const gradientIdExpression = ['$', '{gradientId}'].join('');
  const dynamicFill = `fill={\`url(#${gradientIdExpression})\`}`;
  return source
    .replace('import Svg,', "import { useId } from 'react';\n\nimport Svg,")
    .replace(
      /(const \w+ = \(props: SvgProps\) =>) /,
      `$1 {\n  const gradientId = useId().replace(/:/g, '');\n\n  return `,
    )
    .replace(`fill="url(#${id})"`, dynamicFill)
    .replace(`id="${id}"`, 'id={gradientId}')
    .replace(/;\nexport default/, ';\n};\nexport default');
}

async function generateReactIcons(format) {
  const svgrConfig = {
    ...JSON.parse(fs.readFileSync(svgrConfigPath, 'utf8')),
    plugins: [svgrSvgo, svgrJsx],
    prettier: false,
    runtimeConfig: false,
  };
  const directories = fs
    .readdirSync(svgRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  const groups = directories.map((directory) => ({
    directory,
    files: fs
      .readdirSync(path.join(svgRoot, directory))
      .filter((file) => path.extname(file).toLowerCase() === '.svg')
      // Keep generation deterministic across case-sensitive and insensitive filesystems.
      .toSorted(),
  }));

  fs.rmSync(generatedRoot, { force: true, recursive: true });

  await Promise.all(
    groups.map(async ({ directory, files }) => {
      const sourceDirectory = path.join(svgRoot, directory);
      const outputDirectory = path.join(generatedRoot, directory);
      fs.mkdirSync(outputDirectory, { recursive: true });

      const generated = [];
      for (const file of files) {
        const sourcePath = path.join(sourceDirectory, file);
        const exportName = pascalCase(path.basename(file, path.extname(file)));
        const outputPath = path.join(outputDirectory, `${exportName}.tsx`);
        const source = transform.sync(
          fs.readFileSync(sourcePath, 'utf8'),
          svgrConfig,
          {
            filePath: sourcePath,
          },
        );
        const relativePath = `${directory}/${exportName}.tsx`;
        const { code, errors } = await format(
          outputPath,
          applyGeneratedIconOverrides(relativePath, source),
          FORMAT_OPTIONS,
        );
        if (errors.length > 0) {
          throw new TypeError(
            `Oxfmt failed for ${sourcePath}: ${errors.join(', ')}`,
          );
        }
        fs.writeFileSync(outputPath, code, 'utf8');
        generated.push({ directory, exportName });
      }

      const indexPath = path.join(outputDirectory, 'index.ts');
      const indexSource = generated
        .map(
          ({ exportName }) =>
            `export { default as ${exportName} } from './${exportName}'`,
        )
        .join('\n');
      const { code, errors } = await format(
        indexPath,
        indexSource,
        FORMAT_OPTIONS,
      );
      if (errors.length > 0) {
        throw new TypeError(
          `Oxfmt failed for ${indexPath}: ${errors.join(', ')}`,
        );
      }
      fs.writeFileSync(indexPath, code, 'utf8');
    }),
  );

  return groups.flatMap(({ directory, files }) =>
    files
      .map((file) => ({
        directory,
        exportName: pascalCase(path.basename(file, path.extname(file))),
        sortKey: file.toLowerCase(),
        symbol: pascalCase(
          `${pascalCase(path.basename(file, path.extname(file)))}${directory.toUpperCase()}`,
        ),
      }))
      .toSorted((left, right) => compareStrings(left.sortKey, right.sortKey)),
  );
}

async function buildIconRegistry(format, items) {
  const committedSource = readCommittedIconsSource();
  const committedOrder = committedSource
    ? extractIconSymbolOrder(committedSource)
    : [];
  const committedIndexes = new Map(
    committedOrder.map((symbol, index) => [symbol, index]),
  );
  const orderedItems = items.toSorted((left, right) => {
    const leftIndex = committedIndexes.get(left.symbol);
    const rightIndex = committedIndexes.get(right.symbol);
    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return compareStrings(left.symbol, right.symbol);
  });
  const typesTemplate = `
/* eslint-disable */
  import { I18nManager } from "react-native";

  const icons = {
    ${orderedItems
      .map((item) => {
        if (item.symbol.includes('Left')) {
          const rightSymbol = item.symbol.replace('Left', 'Right');
          const rightItem = orderedItems.find(
            (candidate) => candidate.symbol === rightSymbol,
          );
          if (rightItem) {
            return `${item.symbol}: () => I18nManager.isRTL ? import('./react/${rightItem.directory}/${rightItem.exportName}') : import('./react/${item.directory}/${item.exportName}')`;
          }
        }
        if (item.symbol.includes('Right')) {
          const leftSymbol = item.symbol.replace('Right', 'Left');
          const leftItem = orderedItems.find(
            (candidate) => candidate.symbol === leftSymbol,
          );
          if (leftItem) {
            return `${item.symbol}: () => I18nManager.isRTL ? import('./react/${leftItem.directory}/${leftItem.exportName}') : import('./react/${item.directory}/${item.exportName}')`;
          }
        }
        return `${item.symbol}: () => import('./react/${item.directory}/${item.exportName}')`;
      })
      .join(',')}
  }
  export type IKeyOfIcons = keyof typeof icons;
  export default icons;
`;
  const { code, errors } = await format(
    iconsFilePath,
    typesTemplate,
    FORMAT_OPTIONS,
  );
  if (errors.length > 0) {
    throw new TypeError(
      `Oxfmt failed for ${iconsFilePath}: ${errors.join(', ')}`,
    );
  }
  fs.writeFileSync(iconsFilePath, code, 'utf8');

  if (!committedSource) return;

  const committed = extractIconSymbols(committedSource);
  const current = extractIconSymbols(code);
  const missing = [...committed].filter((symbol) => !current.has(symbol));
  if (missing.length === 0) return;

  if (process.env.ICON_BUILD_ALLOW_REMOVALS === '1') {
    console.warn(
      `[icon:build] ICON_BUILD_ALLOW_REMOVALS=1 — allowing removal of ${missing.length} icon(s): ${missing.join(', ')}`,
    );
    return;
  }

  throw new TypeError(
    [
      '',
      `✗ [icon:build] ${missing.length} icon(s) present in committed Icons.tsx are missing after rebuild:`,
      ...missing.map((symbol) => `    - ${symbol}`),
      '',
      'Likely cause: a hand-written .tsx in src/primitives/Icon/react/ had no',
      'matching SVG source under packages/components/svg/<dir>/<name>.svg.',
      '',
      'Fix: add the missing SVG source(s) so SVGR produces the .tsx.',
      '',
      'If the removal is intentional, re-run with:',
      '  ICON_BUILD_ALLOW_REMOVALS=1 yarn icon:build',
      '',
    ].join('\n'),
  );
}

async function buildIcons() {
  const { format } = await import('oxfmt');
  const items = await generateReactIcons(format);
  await buildIconRegistry(format, items);
}

void buildIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
