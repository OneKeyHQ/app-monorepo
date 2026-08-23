const fs = require('fs');
const path = require('path');

const appLocaleDirectory = path.resolve(
  __dirname,
  '../../../packages/shared/src/locale/json',
);

function resolveElectronLocale(appLocale, availableElectronLocales) {
  const normalizedLocale = appLocale.replaceAll('-', '_');
  if (availableElectronLocales.has(normalizedLocale)) {
    return availableElectronLocales.get(normalizedLocale);
  }

  const [language, region] = normalizedLocale.split('_');
  if (language === 'zh') {
    const traditionalChineseRegions = new Set(['HK', 'MO', 'TW']);
    const electronLocale = traditionalChineseRegions.has(region)
      ? 'zh_TW'
      : 'zh_CN';
    if (availableElectronLocales.has(electronLocale)) {
      return availableElectronLocales.get(electronLocale);
    }
  }

  if (normalizedLocale === 'pt' && availableElectronLocales.has('pt_PT')) {
    return availableElectronLocales.get('pt_PT');
  }

  if (availableElectronLocales.has(language)) {
    return availableElectronLocales.get(language);
  }

  const fallbackLocale =
    availableElectronLocales.get('en_US') ?? availableElectronLocales.get('en');
  if (fallbackLocale) {
    console.warn(
      `[electron-languages] no Electron locale for OneKey locale "${appLocale}", falling back to "${fallbackLocale}"`,
    );
    return fallbackLocale;
  }

  throw new TypeError(
    `No English Electron locale is available as a fallback for OneKey locale "${appLocale}"`,
  );
}

function resolveElectronLanguages(appLocales, electronLocales) {
  const availableElectronLocales = new Map(
    electronLocales.map((locale) => [locale.replaceAll('-', '_'), locale]),
  );
  return [
    ...new Set(
      appLocales.map((appLocale) =>
        resolveElectronLocale(appLocale, availableElectronLocales),
      ),
    ),
  ].toSorted();
}

function readElectronLocales() {
  const electronDistDirectory = path.resolve(
    path.dirname(require.resolve('electron/package.json')),
    'dist',
  );
  const macResourcesDirectory = path.join(
    electronDistDirectory,
    'Electron.app/Contents/Resources',
  );
  if (fs.existsSync(macResourcesDirectory)) {
    return fs
      .readdirSync(macResourcesDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('.lproj'))
      .map((entry) => path.basename(entry.name, '.lproj'));
  }

  const localeDirectory = path.join(electronDistDirectory, 'locales');
  if (fs.existsSync(localeDirectory)) {
    return fs
      .readdirSync(localeDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.pak'))
      .map((entry) => path.basename(entry.name, '.pak'));
  }

  throw new TypeError(
    `No Electron locale resources were found in "${electronDistDirectory}"`,
  );
}

function getElectronLanguages() {
  const appLocales = fs
    .readdirSync(appLocaleDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.basename(fileName, '.json'));

  return resolveElectronLanguages(appLocales, readElectronLocales());
}

module.exports = {
  getElectronLanguages,
  resolveElectronLanguages,
};
