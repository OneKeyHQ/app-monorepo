import enUS from './json/en-US.json';

export const LOCALES = {
  'ar': () => import('./json/ar.json'),
  'bn': () => import('./json/bn.json'),
  'de': () => import('./json/de.json'),
  'en-US': () => import('./json/en-US.json'),
  'es': () => import('./json/es.json'),
  'fil': () => import('./json/fil.json'),
  'fr-FR': () => import('./json/fr_FR.json'),
  'hi-IN': () => import('./json/hi_IN.json'),
  'id': () => import('./json/id.json'),
  'it-IT': () => import('./json/it_IT.json'),
  'ja-JP': () => import('./json/ja_JP.json'),
  'ko-KR': () => import('./json/ko_KR.json'),
  'mn-MN': () => import('./json/mn_MN.json'),
  'pt': () => import('./json/pt.json'),
  'pt-BR': () => import('./json/pt_BR.json'),
  'ru': () => import('./json/ru.json'),
  'th-TH': () => import('./json/th_TH.json'),
  'uk-UA': () => import('./json/uk_UA.json'),
  'vi': () => import('./json/vi.json'),
  'zh-CN': () => import('./json/zh-CN.json'),
  'zh-HK': () => import('./json/zh_HK.json'),
};

export { enUS };
