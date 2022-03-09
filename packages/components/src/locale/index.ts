import de from './de.json';
import enUS from './en-US.json';
import es from './es.json';
import filPH from './fil_PH.json';
import frFR from './fr_FR.json';
import itIT from './it_IT.json';
import jaJP from './ja_JP.json';
import koKR from './ko_KR.json';
import mnMN from './mn_MN.json';
import ru from './ru.json';
import thTH from './th_TH.json';
import ukUA from './uk_UA.json';
import viVN from './vi_VN.json';
import zhCN from './zh-CN.json';
import zhHK from './zh_HK.json';

const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'de': de,
  'es': es,
  'fil-PH': filPH,
  'fr-FR': frFR,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'ru': ru,
  'th-TH': thTH,
  'vi-VN': viVN,
  'zh-HK': zhHK,
  'it-IT': itIT,
  'mn-MN': mnMN,
  'uk-UA': ukUA,
} as const;

export type LocaleSymbol = keyof typeof LOCALES;

export default LOCALES;
