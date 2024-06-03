const path = require('path');
const fs = require('fs-extra');
const { exit } = require('process');

const langDir = path.join(
  __dirname,
  '../../',
  'packages/shared/src/locale/json',
);

const readJson = (langFile) => fs.readJsonSync(path.join(langDir, langFile));

const files = fs.readdirSync(langDir);
const enUSJson = files.find((file) => file === 'en-US.json');

const defaultLang = enUSJson || files.find((file) => file === 'en.json');
const jsonFileNames = files.filter(
  (file) => file.endsWith('.json') && file !== defaultLang,
);

const defaultJsonKey = Object.keys(readJson(defaultLang));

jsonFileNames.forEach((file) => {
  const json = readJson(file);
  const jsonKeys = Object.keys(json);
  const missingKeys = defaultJsonKey.filter((key) => !jsonKeys.includes(key));

  if (missingKeys.length) {
    console.log(`Missing keys in ${file}:`);
    console.log(missingKeys);
    exit(1);
  }
});
