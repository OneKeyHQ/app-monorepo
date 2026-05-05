require('../../../development/env');

const transformTranslationEnumKey = require('../../../development/scripts/i18n/transform-translation-enum-key');

module.exports = {
  translations: {
    dist: './src/locale/json',
    token: process.env.LOKALISE_TOKEN,
    clean: true,
    useFlat: true,
    delimiter: '.',
    declaration: {
      dist: './src/locale/enum',
      transformKey: transformTranslationEnumKey,
    },
    projects: [
      {
        'id': process.env.LOKALISE_PROJECT_ID,
      },
    ],
  },
};
