const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const lodash = require('lodash');

const base = path.resolve(__dirname, './react');
const dirs = fs.readdirSync(base);

const pascalCase = (str) =>
  lodash.camelCase(str).replace(/^(.)/, lodash.toUpper);

const items = [];

dirs.forEach((dir) => {
  const files = fs.readdirSync(path.resolve(base, `${dir}`));
  files
    .filter((item) => !item.includes('index'))
    .forEach((file) => {
      const basicName = path.basename(file, path.extname(file));
      items.push({
        symbol: pascalCase(`${basicName}${dir.toUpperCase()}`),
        path: `${dir}/${basicName}`,
        name: pascalCase(`${basicName}${dir.toUpperCase()}`),
      });
    });
});

const typesTemplate = `
/* eslint-disable */

  ${items
    .map((item) => {
      return `import ${item.name} from './react/${item.path}';`;
    })
    .join('\n')}

export type ICON_NAMES = ${items.map((item) => `"${item.symbol}"`).join(' | ')};

  export default {
    ${items
      .map((item) => {
        return `"${item.symbol}": ${item.name}`;
      })
      .join(',')}
  }
`;
fs.writeFileSync(
  path.resolve(__dirname, `./Icons.tsx`),
  prettier.format(typesTemplate, { parser: 'typescript' }),
  'utf8',
);
