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
  `// This file is automatically created by \`yarn fetch:locale\`.
// @ts-ignore
/* eslint-disable  */

import enUS from './json/${defaultLocaleJsonFile}';

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

const typeFile = path.join(__dirname, '../src/locale/enum/translations.ts');

const text = fs.readFileSync(typeFile, 'utf8');
fs.writeFileSync(
  typeFile,
  `// This file is automatically created by \`yarn fetch:locale\`.\n
// @ts-ignore
/* eslint-disable  */
  
  ${text
    .replace('export enum Translations {', 'export enum ETranslations {')
    // fix lint of type file.
    // Simply lint the file, it's faster than eslint.
    .replaceAll('	', '  ')
    .replaceAll('  =', ' =')}`,
  'utf8',
);
