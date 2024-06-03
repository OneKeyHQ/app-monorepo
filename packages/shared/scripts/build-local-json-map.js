const fs = require('fs-extra');
const path = require('path');

const localeJsonPath = path.join(__dirname, '../src/locale/json');

const jsonFiles = fs
  .readdirSync(localeJsonPath)
  .filter((file) => file.endsWith('.json'));

const enUSJsonFile = jsonFiles.find((i) => i === 'en-US.json');

const defaultLocaleJsonFile =
  enUSJsonFile || jsonFiles.find((i) => i === 'en.json');

fs.writeFileSync(
  path.join(__dirname, '../src/locale/localeJsonMap.ts'),
  `import enUS from './json/${defaultLocaleJsonFile}';

export const LOCALES = {
${jsonFiles
  .map(
    (file) =>
      `  '${file
        .split('.')[0]
        .replace(/_/g, '-')}': () => import('./json/${file}'),`,
  )
  .join('\n')}
};

export { enUS };
`,
);
