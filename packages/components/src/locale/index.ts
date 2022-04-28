import de from './de.json';
import enUS from './en-US.json';
import es from './es.json';
// import filPH from './fil_PH.json';
import frFR from './fr_FR.json';
import hiIN from './hi_IN.json';
import itIT from './it_IT.json';
import jaJP from './ja_JP.json';
import koKR from './ko_KR.json';
import mnMN from './mn_MN.json';
import ru from './ru.json';
import thTH from './th_TH.json';
import ukUA from './uk_UA.json';
// import viVN from './vi_VN.json';
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

const LOCALES = buildLocalesData(
  ['zh-CN', zhCN],
  ['en-US', enUS],
  ['de', de],
  ['es', es],
  // ['fil-PH', filPH],
  ['fr-FR', frFR],
  ['ja-JP', jaJP],
  ['ko-KR', koKR],
  ['ru', ru],
  ['th-TH', thTH],
  // ['vi-VN', viVN],
  ['zh-HK', zhHK],
  ['it-IT', itIT],
  ['mn-MN', mnMN],
  ['uk-UA', ukUA],
  ['hi-IN', hiIN],
);

export type LocaleSymbol = keyof typeof LOCALES;
export type LocaleIds = keyof typeof enUS;

export default LOCALES;
