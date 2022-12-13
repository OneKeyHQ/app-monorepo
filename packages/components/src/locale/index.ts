import ISO6391 from 'iso-639-1';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import bn from './bn.json';
import de from './de.json';
import enUS from './en-US.json';
import es from './es.json';
import fil from './fil.json';
import frFR from './fr_FR.json';
import hiIN from './hi_IN.json';
import itIT from './it_IT.json';
import jaJP from './ja_JP.json';
import koKR from './ko_KR.json';
import mnMN from './mn_MN.json';
import pt from './pt.json';
import ru from './ru.json';
import thTH from './th_TH.json';
import ukUA from './uk_UA.json';
import vi from './vi.json';
import zhCN from './zh-CN.json';
import zhHK from './zh_HK.json';

function validateI18nKeys(name: string, data: typeof enUS) {
  if (Object.keys(data).length !== Object.keys(enUS).length) {
    throw new Error(`lang=${name} missing i18n keys.`);
  }
  return data;
}

function buildLocalesData(...items: Array<[string, typeof enUS]>) {
  const locales: Record<string, typeof enUS> = {};
  items.forEach((item) => {
    const [name, data] = item;
    locales[name] = validateI18nKeys(name, data);
  });
  return locales;
}

const defaultLanguage: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文',
  'fil': 'Filipino',
};

const getLanguage = (symbol: string): string => {
  let languageName: string | undefined = defaultLanguage[symbol];
  if (languageName) return languageName;

  languageName = ISO6391.getNativeName(symbol);
  if (languageName) return languageName;

  languageName = ISO6391.getName(symbol);
  if (languageName) return languageName;

  if (symbol.indexOf('-') !== -1) {
    const [symbolShort] = symbol.split('-');

    languageName = ISO6391.getNativeName(symbolShort);
    if (languageName) return languageName;

    languageName = ISO6391.getName(symbolShort);
    if (languageName) return languageName;
  }

  return symbol;
};

const LOCALES = buildLocalesData(
  ['en-US', enUS],
  ['zh-CN', zhCN],
  ['zh-HK', zhHK],
  ['ja-JP', jaJP],
  ['ko-KR', koKR],
  ['bn', bn],
  ['de', de],
  ['es', es],
  ['fil', fil],
  ['fr-FR', frFR],
  ['hi-IN', hiIN],
  ['it-IT', itIT],
  ['mn-MN', mnMN],
  ['pt', pt],
  ['ru', ru],
  ['th-TH', thTH],
  ['uk-UA', ukUA],
  ['vi', vi],
);

const LOCALES_OPTION = Object.keys(LOCALES).map((key) => ({
  value: key,
  label: getLanguage(key),
}));

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/locale is not allowed imported from background');
}

export type LocaleSymbol = keyof typeof LOCALES;
export type LocaleIds = keyof typeof enUS;

export default LOCALES;
export { LOCALES_OPTION };
