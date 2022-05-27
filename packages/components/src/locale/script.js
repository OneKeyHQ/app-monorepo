const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const ISO6391 = require('iso-639-1');

const base = __dirname;
const files = fs.readdirSync(base).filter((file) => file.endsWith('.json'));

const defaultPriority = {
  'en-US': 1000,
  'en': 1000,
  'zh-CN': 900,
  'zh-HK': 900,
  'ja-JP': 800,
  'ko-KR': 800,
  'ko': 800,
};

const defaultLanguage = {
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文',
};

const getLanguage = (symbol) => {
  let languageName = defaultLanguage[symbol];
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

  return undefined;
};

const items = [];

files.forEach((file, index) => {
  try {
    const fileArray = file.split('.');
    const symbol = fileArray[0].replace('_', '-');

    const languageName = getLanguage(symbol);

    items.push({
      priority: (defaultPriority[symbol] ?? 0) - index,
      label: languageName,
      name: symbol.replace('-', ''),
      symbol,
      path: file,
    });
  } catch (error) {
    console.log(error);
  }
});

const typesTemplate = `
/* eslint-disable */

  ${items
    .map((item) => `import ${item.name} from './${item.path}';`)
    .join('\n')}

function validateI18nKeys(name: string, data: typeof enUS) {
    if (Object.keys(data).length !== Object.keys(enUS).length) {
        throw new Error(\`lang=\${name} missing i18n keys.\`);
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
    ${items.map((item) => `['${item.symbol}', ${item.name}]`).join(',\n')},
);

const LOCALES_OPTION = [
    ${items
      .sort((a, b) => b.priority - a.priority)
      .map((item) => `{ label:'${item.label}', value:'${item.symbol}' }`)
      .join(',\n')},
]

export { LOCALES, LOCALES_OPTION };
`;

fs.writeFileSync(
  path.resolve(__dirname, `./Locale.ts`),
  prettier.format(typesTemplate, { parser: 'typescript' }),
  'utf8',
);
