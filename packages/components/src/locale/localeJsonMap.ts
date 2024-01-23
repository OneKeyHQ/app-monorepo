import enUS from './en-US.json';

export const LOCALES = {
  'en-US': enUS,
  'zh-CN': () => import('./zh-CN.json'),
  'zh-HK': () => import('./zh_HK.json'),
  'ja-JP': () => import('./ja_JP.json'),
  'ko-KR': () => import('./ko_KR.json'),
  'bn': () => import('./bn.json'),
  'de': () => import('./de.json'),
  'es': () => import('./es.json'),
  'fil': () => import('./fil.json'),
  'fr-FR': () => import('./fr_FR.json'),
  'hi-IN': () => import('./hi_IN.json'),
  'it-IT': () => import('./it_IT.json'),
  'mn-MN': () => import('./mn_MN.json'),
  'pt': () => import('./pt.json'),
  'ru': () => import('./ru.json'),
  'th-TH': () => import('./th_TH.json'),
  'uk-UA': () => import('./uk_UA.json'),
  'vi': () => import('./vi.json'),
  'id': () => import('./id.json'),
  'pt-BR': () => import('./pt_BR.json'),
};

export { enUS };
