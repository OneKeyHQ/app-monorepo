const fs = require('fs');
const path = require('path');

const appLocaleDirectory = path.resolve(
  __dirname,
  '../../../packages/shared/src/locale/json',
);

const englishElectronLocales = ['en', 'en-US'];

function expandElectronLocaleNames(locale) {
  const normalizedLocale = locale.replaceAll('-', '_');
  return normalizedLocale.includes('_')
    ? [normalizedLocale, normalizedLocale.replaceAll('_', '-')]
    : [normalizedLocale];
}

function getElectronLocaleCandidates(appLocale) {
  const normalizedLocale = appLocale.replaceAll('-', '_');
  const [language, region] = normalizedLocale.split('_');
  const candidates = new Set([normalizedLocale, language]);

  if (language === 'zh') {
    const traditionalChineseRegions = new Set(['HK', 'MO', 'TW']);
    candidates.add(traditionalChineseRegions.has(region) ? 'zh_TW' : 'zh_CN');
  }

  if (normalizedLocale === 'pt') {
    candidates.add('pt_PT');
  }

  return [...candidates].flatMap(expandElectronLocaleNames);
}

function resolveElectronLanguages(appLocales) {
  // electron-builder v26 compares locale file names exactly. Keep both macOS
  // underscore names and Windows/Linux hyphen names because one invocation can
  // build targets for multiple platforms from the same host.
  return [
    ...new Set(
      englishElectronLocales.concat(
        appLocales.flatMap(getElectronLocaleCandidates),
      ),
    ),
  ].toSorted();
}

function getElectronLanguages() {
  const appLocales = fs
    .readdirSync(appLocaleDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.basename(fileName, '.json'));

  return resolveElectronLanguages(appLocales);
}

module.exports = {
  getElectronLanguages,
  resolveElectronLanguages,
};
