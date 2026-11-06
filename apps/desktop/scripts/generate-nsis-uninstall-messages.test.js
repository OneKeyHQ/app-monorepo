const fs = require('fs');
const path = require('path');

const {
  escapeNsisString,
  generateUninstallMessages,
} = require('./generate-nsis-uninstall-messages');

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
const nativeLanguageIds = {
  nl: 1043,
  da: 1030,
  sv: 1053,
  nb: 1044,
  fi: 1035,
  pl: 1045,
  cs: 1029,
  sk: 1051,
  hu: 1038,
  ar: 1025,
  tr: 1055,
};

function withChangedJson(filePath, update, verify) {
  const readFile = fs.readFileSync;
  const source = JSON.parse(readFile(filePath, 'utf8'));
  update(source);
  const readSpy = jest
    .spyOn(fs, 'readFileSync')
    .mockImplementation((currentPath, ...options) =>
      currentPath === filePath
        ? JSON.stringify(source)
        : readFile(currentPath, ...options),
    );
  try {
    verify();
  } finally {
    readSpy.mockRestore();
  }
}

describe('NSIS uninstall warnings', () => {
  test('generates exactly the existing 26 native language IDs', () => {
    const languageIds = [
      ...generateUninstallMessages().matchAll(
        /^LangString OneKeyUninstallWarning (\d+) /gm,
      ),
    ].map((match) => Number(match[1]));
    expect(languageIds).toHaveLength(26);
    expect(new Set(languageIds).size).toBe(26);
    expect(languageIds.toSorted((left, right) => left - right)).toEqual(
      [
        ...sharedLocales.map(([, languageId]) => languageId),
        ...Object.values(nativeLanguageIds),
      ].toSorted((left, right) => left - right),
    );
  });

  test.each(sharedLocales)(
    'reuses the modern %s warning verbatim',
    (locale, languageId) => {
      const theme = JSON.parse(
        fs.readFileSync(path.join(themeDirectory, 'theme.json'), 'utf8'),
      );
      const translations = JSON.parse(
        fs.readFileSync(
          path.join(themeDirectory, theme.locales[locale]),
          'utf8',
        ),
      );
      expect(generateUninstallMessages()).toContain(
        `LangString OneKeyUninstallWarning ${languageId} "${escapeNsisString(translations['uninstall.confirmSubtitle'])}"\n`,
      );
    },
  );

  test('keeps the 11 native-only warnings without NSIS placeholders', () => {
    const warnings = JSON.parse(fs.readFileSync(nativeMessagesPath, 'utf8'));
    expect(Object.keys(warnings).toSorted()).toEqual(
      Object.keys(nativeLanguageIds).toSorted(),
    );
    const generated = generateUninstallMessages();
    for (const [locale, languageId] of Object.entries(nativeLanguageIds)) {
      expect(warnings[locale]).not.toMatch(/\$\(|\$\{/);
      expect(warnings[locale].split('\n\n')).toHaveLength(2);
      expect(generated).toContain(
        `LangString OneKeyUninstallWarning ${languageId} "${escapeNsisString(warnings[locale])}"\n`,
      );
    }
  });

  test.each([undefined, '', ' \r\n', 42])(
    'rejects a missing or empty modern warning: %s',
    (warning) => {
      withChangedJson(
        path.join(themeDirectory, 'locales/en-US.json'),
        (source) => {
          source['uninstall.confirmSubtitle'] = warning;
        },
        () => {
          expect(generateUninstallMessages).toThrow(
            'Missing uninstall warning: en-US',
          );
        },
      );
    },
  );

  test.each([undefined, '', ' \r\n', 42])(
    'rejects a missing or empty native warning: %s',
    (warning) => {
      withChangedJson(
        nativeMessagesPath,
        (source) => {
          source.nl = warning;
        },
        () => {
          expect(generateUninstallMessages).toThrow(
            'Missing uninstall warning: nl',
          );
        },
      );
    },
  );

  test('rejects missing modern locale mappings', () => {
    withChangedJson(
      path.join(themeDirectory, 'theme.json'),
      (source) => {
        delete source.locales.de;
      },
      () => {
        expect(generateUninstallMessages).toThrow(
          'Missing modern uninstall locale: de',
        );
      },
    );
  });

  test('rejects conflicting sources instead of choosing a translation', () => {
    withChangedJson(
      path.join(themeDirectory, 'theme.json'),
      (source) => {
        source.locales.nl = 'locales/en-US.json';
      },
      () => {
        expect(generateUninstallMessages).toThrow(
          'Conflicting uninstall locale sources: nl',
        );
      },
    );
  });

  test('rejects unexpected native locales', () => {
    withChangedJson(
      nativeMessagesPath,
      (source) => {
        source['en-US'] = 'duplicate English warning';
      },
      () => {
        expect(generateUninstallMessages).toThrow(
          'Unexpected native uninstall locale: en-US',
        );
      },
    );
  });

  test('escapes NSIS macros, variables, quotes and line endings', () => {
    const warning = `\${PRODUCT_NAME} \${UNKNOWN} $LANGUAGE $(something) "C:\\wallet"\r\nnext`;
    expect(escapeNsisString(warning)).toBe(
      `\${U+24}\${U+24}{PRODUCT_NAME} \${U+24}\${U+24}{UNKNOWN} \${U+24}\${U+24}LANGUAGE \${U+24}\${U+24}(something) $\\"C:\\wallet$\\"$\\r$\\nnext`,
    );
  });

  test('reads changed source text again on every generation', () => {
    const previous = generateUninstallMessages();
    withChangedJson(
      path.join(themeDirectory, 'locales/en-US.json'),
      (source) => {
        source['uninstall.confirmSubtitle'] = 'Updated wallet warning';
      },
      () => {
        const updated = generateUninstallMessages();
        expect(updated).not.toBe(previous);
        expect(updated).toContain(
          'LangString OneKeyUninstallWarning 1033 "Updated wallet warning"\n',
        );
      },
    );
    expect(generateUninstallMessages()).toBe(previous);
  });
});
