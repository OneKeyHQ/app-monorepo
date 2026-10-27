const path = require('path');

const fs = require('fs-extra');

const transformTranslationEnumKey = require('./transform-translation-enum-key');
const outputRootIndex = process.argv.indexOf('--output-root');
if (outputRootIndex !== -1 && !process.argv[outputRootIndex + 1])
  throw new Error('Missing --output-root value.');
const outputRoot =
  outputRootIndex === -1
    ? path.resolve(__dirname, '../../..')
    : path.resolve(process.argv[outputRootIndex + 1]);

const localeJsonPath = path.join(outputRoot, 'packages/shared/src/locale/json');

// build localeJsonMap.ts
const jsonFiles = fs
  .readdirSync(localeJsonPath)
  .filter((file) => file.endsWith('.json'));

const enJSONFile = 'en.json';
const defaultLocaleJsonFile = jsonFiles.find((i) => i === 'en_US.json');
const enJsonPath = path.join(localeJsonPath, enJSONFile);

fs.writeFileSync(
  path.join(outputRoot, 'packages/shared/src/locale/localeJsonMap.ts'),
  `// This file is automatically created by \`yarn i18n:pull\`.
// @ts-ignore
/* eslint-disable  */

import enUS from './json/${defaultLocaleJsonFile}';

export const LOCALES = {
${jsonFiles
  .map((file) =>
    file !== defaultLocaleJsonFile && file !== enJSONFile
      ? `  '${file
          .split('.')[0]
          .replace(/_/g, '-')}': () => import('./json/${file}'),`
      : `  '${file.split('.')[0].replace(/_/g, '-')}': enUS,`,
  )
  .join('\n')}
  'en': enUS,
};

export { enUS };
`,
);

const typeFile = path.join(
  outputRoot,
  'packages/shared/src/locale/enum/translations.ts',
);

function stripGeneratedHeader(text) {
  return text
    .replace(
      /^(?:\/\/ This file is automatically created by `yarn [^`]+`\.\n+\s*\/\/ @ts-ignore\n\/\* eslint-disable  \*\/\n\s*)+/,
      '',
    )
    .trimStart();
}

function normalizeTranslationEnumMembers(text) {
  const seenMemberNames = new Set();

  return text.replace(
    /^(\s*)([^=\n]+?)\s*=\s*'([^']+)',$/gm,
    (_match, indent, _memberName, translationKey) => {
      const normalizedMemberName = transformTranslationEnumKey(
        translationKey.split('.'),
      );

      if (seenMemberNames.has(normalizedMemberName)) {
        return '';
      }
      seenMemberNames.add(normalizedMemberName);

      return `${indent}${normalizedMemberName} = '${translationKey}',`;
    },
  );
}

const text = stripGeneratedHeader(fs.readFileSync(typeFile, 'utf8'));
fs.writeFileSync(
  typeFile,
  `// This file is automatically created by \`yarn i18n:pull\`.\n\n// @ts-ignore\n/* eslint-disable  */\n\n${text
    .replace('export enum Translations {', 'export enum ETranslations {')
    .replace(/export enum ETranslations \{[\s\S]*$/, (enumText) =>
      normalizeTranslationEnumMembers(enumText),
    )
    // fix lint of type file.
    // Simply lint the file, it's faster than eslint.
    .replaceAll('	', '  ')
    .replaceAll('  =', ' =')
    // fix enum member names with dots (invalid TS identifiers)
    .replace(/^(\s+)([a-z0-9_.]+)\s*=/gm, (match, indent, member) =>
      member.includes('.') ? `${indent}${member.replace(/\./g, '_')} =` : match,
    )}`,
  'utf8',
);

// Delete en.json file if exists
if (fs.existsSync(enJsonPath)) {
  fs.unlinkSync(enJsonPath);
}
