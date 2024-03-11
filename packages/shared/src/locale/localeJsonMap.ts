import enUS from './jsons/en-US.json';

export const LOCALES = {
  'en-US': enUS,
  'zh-CN': () => import('./jsons/zh-CN.json'),
  'zh-HK': () => import('./jsons/zh_HK.json'),
  'ja-JP': () => import('./jsons/ja_JP.json'),
  'ko-KR': () => import('./jsons/ko_KR.json'),
  'bn': () => import('./jsons/bn.json'),
  'de': () => import('./jsons/de.json'),
  'es': () => import('./jsons/es.json'),
  'fil': () => import('./jsons/fil.json'),
  'fr-FR': () => import('./jsons/fr_FR.json'),
  'hi-IN': () => import('./jsons/hi_IN.json'),
  'it-IT': () => import('./jsons/it_IT.json'),
  'mn-MN': () => import('./jsons/mn_MN.json'),
  'pt': () => import('./jsons/pt.json'),
  'ru': () => import('./jsons/ru.json'),
  'th-TH': () => import('./jsons/th_TH.json'),
  'uk-UA': () => import('./jsons/uk_UA.json'),
  'vi': () => import('./jsons/vi.json'),
  'id': () => import('./jsons/id.json'),
};

export { enUS };
