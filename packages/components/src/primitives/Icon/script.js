const fs = require('fs');
const path = require('path');

const lodash = require('lodash');

const svgRoot = path.resolve(__dirname, '../../../svg');
const iconsFilePath = path.join(__dirname, 'Icons.tsx');
const pascalCase = (value) =>
  lodash.camelCase(value).replace(/^(.)/, lodash.toUpper);

function collectIcons(root = svgRoot) {
  const names = [];
  for (const group of fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())) {
    for (const file of fs
      .readdirSync(path.join(root, group.name))
      .filter((entry) => path.extname(entry).toLowerCase() === '.svg')
      .toSorted()) {
      names.push(
        pascalCase(
          `${pascalCase(path.basename(file, '.svg'))}${group.name.toUpperCase()}`,
        ),
      );
    }
  }
  if (new Set(names).size !== names.length) {
    throw new TypeError('Canonical SVG names must be unique');
  }
  return names.toSorted();
}

async function generateRegistry(names) {
  const { format } = await import('oxfmt');
  const known = new Set(names);
  const rtl = names.flatMap((name) => {
    let partner;
    if (name.includes('Left')) partner = name.replace('Left', 'Right');
    else if (name.includes('Right')) partner = name.replace('Right', 'Left');
    return partner && known.has(partner) ? [`${name}: '${partner}'`] : [];
  });
  const source = `// Generated from packages/components/svg. Run yarn icon:build.\nconst icons = {\n${names.map((name) => `${name}: '${name}',`).join('\n')}\n} as const;\n\nexport type IKeyOfIcons = keyof typeof icons;\nconst rtlIcons: Partial<Record<IKeyOfIcons, IKeyOfIcons>> = {${rtl.join(',\n')}};\nexport const resolveIconName = (name: IKeyOfIcons, isRTL: boolean): IKeyOfIcons => isRTL ? rtlIcons[name] ?? name : name;\nexport default icons;\n`;
  const result = await format(iconsFilePath, source, {
    printWidth: 80,
    quoteProps: 'preserve',
    singleQuote: true,
    trailingComma: 'all',
  });
  if (result.errors.length) throw new TypeError(result.errors.join(', '));
  return result.code;
}

async function buildIcons({ check = false } = {}) {
  const { generateOutputs, writeOutputs } =
    await import('../../../../../development/onekey-icons/generate-icons.mjs');
  const resources = await generateOutputs();
  const source = await generateRegistry(collectIcons());
  writeOutputs(resources.outputs, check);
  if (fs.readFileSync(iconsFilePath, 'utf8') !== source) {
    if (check) throw new TypeError('Icon names are stale; run yarn icon:build');
    fs.writeFileSync(iconsFilePath, source);
  }
}

module.exports = { collectIcons, generateRegistry, buildIcons };
if (require.main === module) {
  void buildIcons({ check: process.argv.includes('--check') }).catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
