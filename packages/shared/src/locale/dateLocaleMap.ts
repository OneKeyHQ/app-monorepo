import {
  bn,
  de,
  enUS,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  mn,
  pt,
  ru,
  th,
  uk,
  vi,
  zhCN,
  zhHK,
} from 'date-fns/locale';

import type { ILocaleSymbol } from '@onekeyhq/components';

const DateLocaleMap: Record<Exclude<ILocaleSymbol, 'system'>, Locale> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-HK': zhHK,
  'ja-JP': ja,
  'ko-KR': ko,
  'bn': bn,
  'de': de,
  'es': es,
  'fr-FR': fr,
  'hi-IN': hi,
  'it-IT': it,
  'mn-MN': mn,
  'pt': pt,
  'ru': ru,
  'th-TH': th,
  'uk-UA': uk,
  'vi': vi,
  'id': id,

  // no fil in date-fns
  'fil': enUS,
};

export { DateLocaleMap };
