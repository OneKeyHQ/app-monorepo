const fs = require('fs');
const path = require('path');

const appLocaleDirectory = path.resolve(
  __dirname,
  '../../../packages/shared/src/locale/json',
);
const electronResourcesDirectory = path.resolve(
  path.dirname(require.resolve('electron/package.json')),
  'dist/Electron.app/Contents/Resources',
);

function resolveElectronLocale(appLocale, availableElectronLocales) {
  const normalizedLocale = appLocale.replaceAll('-', '_');
  if (availableElectronLocales.has(normalizedLocale)) {
    return normalizedLocale;
  }

  const [language, region] = normalizedLocale.split('_');
  if (language === 'zh') {
    const traditionalChineseRegions = new Set(['HK', 'MO', 'TW']);
    const electronLocale = traditionalChineseRegions.has(region)
      ? 'zh_TW'
      : 'zh_CN';
    if (availableElectronLocales.has(electronLocale)) {
      return electronLocale;
    }
  }

  if (normalizedLocale === 'pt' && availableElectronLocales.has('pt_PT')) {
    return 'pt_PT';
  }

  if (availableElectronLocales.has(language)) {
    return language;
  }

  throw new TypeError(
    `No Electron locale is available for OneKey locale "${appLocale}"`,
  );
}

function resolveElectronLanguages(appLocales, electronLocales) {
  const availableElectronLocales = new Set(electronLocales);
  return [
    ...new Set(
      appLocales.map((appLocale) =>
        resolveElectronLocale(appLocale, availableElectronLocales),
      ),
    ),
  ].toSorted();
}

function getElectronLanguages() {
  const appLocales = fs
    .readdirSync(appLocaleDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.basename(fileName, '.json'));
  const electronLocales = fs
    .readdirSync(electronResourcesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.lproj'))
    .map((entry) => path.basename(entry.name, '.lproj'));

  return resolveElectronLanguages(appLocales, electronLocales);
}

module.exports = {
  getElectronLanguages,
  resolveElectronLanguages,
};
