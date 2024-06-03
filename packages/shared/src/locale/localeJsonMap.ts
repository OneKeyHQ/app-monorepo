import enUS from './json/en-US.json';

export const LOCALES = {
  'en-US': enUS,
  'zh-CN': () => import('./json/zh-CN.json'),
  'zh-HK': () => import('./json/zh_HK.json'),
  'ja-JP': () => import('./json/ja_JP.json'),
  'ko-KR': () => import('./json/ko_KR.json'),
  'bn': () => import('./json/bn.json'),
  'de': () => import('./json/de.json'),
  'es': () => import('./json/es.json'),
  'fil': () => import('./json/fil.json'),
  'fr-FR': () => import('./json/fr_FR.json'),
  'hi-IN': () => import('./json/hi_IN.json'),
  'it-IT': () => import('./json/it_IT.json'),
  'mn-MN': () => import('./json/mn_MN.json'),
  'pt': () => import('./json/pt.json'),
  'ru': () => import('./json/ru.json'),
  'th-TH': () => import('./json/th_TH.json'),
  'uk-UA': () => import('./json/uk_UA.json'),
  'vi': () => import('./json/vi.json'),
  'id': () => import('./json/id.json'),
};

export { enUS };
