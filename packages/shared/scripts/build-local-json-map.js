const fs = require('fs-extra');
const path = require('path');

const localeJsonPath = path.join(__dirname, '../src/locale/json');

// build localeJsonMap.ts
const jsonFiles = fs
  .readdirSync(localeJsonPath)
  .filter((file) => file.endsWith('.json'));

const defaultLocaleJsonFile = jsonFiles.find((i) => i === 'en_US.json');

fs.writeFileSync(
  path.join(__dirname, '../src/locale/localeJsonMap.ts'),
  `import enUS from './json/${defaultLocaleJsonFile}';

export const LOCALES = {
${jsonFiles
  .map((file) =>
    file !== defaultLocaleJsonFile
      ? `  '${file
          .split('.')[0]
          .replace(/_/g, '-')}': () => import('./json/${file}'),`
      : `  '${file.split('.')[0].replace(/_/g, '-')}': enUS,`,
  )
  .join('\n')}
};

export { enUS };
`,
);

// fix lint of type file.
const typeFile = path.join(__dirname, '../src/locale/enum/translations.ts');

const text = fs.readFileSync(typeFile, 'utf8');
fs.writeFileSync(
  typeFile,
  text
    .replace('export enum Translations {', 'export enum ETranslations {')
    .replaceAll('	', '  '),
  'utf8',
);
