// oxlint-disable onekey/no-raw-error -- Standalone build tooling cannot load application runtime errors.
const fs = require('fs');
const path = require('path');

const themeDirectory = path.join(
  __dirname,
  '../build/nsis-duilib-ui/onekey-modern',
);
const nativeMessagesPath = path.join(
  __dirname,
  '../build/nsis-duilib-ui/uninstall-messages.json',
);
const sharedLocales = [
  ['en-US', 1033],
  ['de', 1031],
  ['fr-FR', 1036],
  ['es', 3082],
  ['zh-CN', 2052],
  ['zh-TW', 1028],
  ['ja-JP', 1041],
  ['ko-KR', 1042],
  ['it-IT', 1040],
  ['ru', 1049],
  ['pt', 2070],
  ['pt-BR', 1046],
  ['uk-UA', 1058],
  ['th-TH', 1054],
  ['vi', 1066],
];
const nativeLocales = [
  ['nl', 1043],
  ['da', 1030],
  ['sv', 1053],
  ['nb', 1044],
  ['fi', 1035],
  ['pl', 1045],
  ['cs', 1029],
  ['sk', 1051],
  ['hu', 1038],
  ['ar', 1025],
  ['tr', 1055],
];

function escapeNsisString(value) {
  return value.replace(/[$"\r\n\t]/g, (character) => {
    switch (character) {
      case '$':
        return `\${U+24}\${U+24}`;
      case '"':
        return '$\\"';
      case '\r':
        return '$\\r';
      case '\n':
        return '$\\n';
      case '\t':
        return '$\\t';
      default:
        return character;
    }
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function serializeUninstallMessage([locale, languageId, warning]) {
  if (typeof warning !== 'string' || !warning.trim()) {
    throw new Error(`Missing uninstall warning: ${locale}`);
  }
  if (warning.includes('\0')) {
    throw new Error(`Invalid uninstall warning: ${locale}`);
  }
  return `LangString OneKeyUninstallWarning ${languageId} "${escapeNsisString(warning)}"\n`;
}

function generateUninstallMessages() {
  const theme = readJson(path.join(themeDirectory, 'theme.json'));
  const nativeMessages = readJson(nativeMessagesPath);
  const expectedNativeLocales = new Set(
    nativeLocales.map(([locale]) => locale),
  );
  for (const locale of Object.keys(nativeMessages)) {
    if (!expectedNativeLocales.has(locale)) {
      throw new Error(`Unexpected native uninstall locale: ${locale}`);
    }
  }
  for (const [locale] of nativeLocales) {
    if (Object.prototype.hasOwnProperty.call(theme.locales, locale)) {
      throw new Error(`Conflicting uninstall locale sources: ${locale}`);
    }
  }

  const messages = sharedLocales.map(([locale, languageId]) => {
    const localeFile = theme.locales[locale];
    if (typeof localeFile !== 'string' || !localeFile.trim()) {
      throw new Error(`Missing modern uninstall locale: ${locale}`);
    }
    const translations = readJson(path.join(themeDirectory, localeFile));
    return [locale, languageId, translations['uninstall.confirmSubtitle']];
  });
  messages.push(
    ...nativeLocales.map(([locale, languageId]) => [
      locale,
      languageId,
      nativeMessages[locale],
    ]),
  );

  return messages.map(serializeUninstallMessage).join('');
}

if (require.main === module) {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error('Expected an output path for NSIS uninstall messages');
  }
  fs.writeFileSync(outputPath, generateUninstallMessages(), 'utf8');
}

module.exports = { escapeNsisString, generateUninstallMessages };
