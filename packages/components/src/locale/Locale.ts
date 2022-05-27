/* eslint-disable */

import ar from "./ar.json";
import bn from "./bn.json";
import de from "./de.json";
import enUS from "./en-US.json";
import es from "./es.json";
import fil from "./fil.json";
import frFR from "./fr_FR.json";
import hiIN from "./hi_IN.json";
import itIT from "./it_IT.json";
import jaJP from "./ja_JP.json";
import koKR from "./ko_KR.json";
import mnMN from "./mn_MN.json";
import pt from "./pt.json";
import ru from "./ru.json";
import thTH from "./th_TH.json";
import ukUA from "./uk_UA.json";
import vi from "./vi.json";
import zhCN from "./zh-CN.json";
import zhHK from "./zh_HK.json";

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
  ["ar", ar],
  ["bn", bn],
  ["de", de],
  ["en-US", enUS],
  ["es", es],
  ["fil", fil],
  ["fr-FR", frFR],
  ["hi-IN", hiIN],
  ["it-IT", itIT],
  ["ja-JP", jaJP],
  ["ko-KR", koKR],
  ["mn-MN", mnMN],
  ["pt", pt],
  ["ru", ru],
  ["th-TH", thTH],
  ["uk-UA", ukUA],
  ["vi", vi],
  ["zh-CN", zhCN],
  ["zh-HK", zhHK]
);

const LOCALES_OPTION = [
  { label: "English", value: "en-US" },
  { label: "简体中文", value: "zh-CN" },
  { label: "繁体中文", value: "zh-HK" },
  { label: "日本語", value: "ja-JP" },
  { label: "한국어", value: "ko-KR" },
  { label: "اَلْعَرَبِيَّةُ", value: "ar" },
  { label: "বাংলা", value: "bn" },
  { label: "Deutsch", value: "de" },
  { label: "Español", value: "es" },
  { label: "undefined", value: "fil" },
  { label: "Français", value: "fr-FR" },
  { label: "हिन्दी", value: "hi-IN" },
  { label: "Italiano", value: "it-IT" },
  { label: "Монгол хэл", value: "mn-MN" },
  { label: "Português", value: "pt" },
  { label: "Русский", value: "ru" },
  { label: "ไทย", value: "th-TH" },
  { label: "Українська", value: "uk-UA" },
  { label: "Tiếng Việt", value: "vi" },
];

export { LOCALES, LOCALES_OPTION };
