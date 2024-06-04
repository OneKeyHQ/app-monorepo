require('../../../development/env');

module.exports = {
  translations: {
    dist: './src/locale/json',
    token: process.env.LOKALISE_TOKEN,
    clean: true,
    useFlat: true,
    delimiter: '.',
    declaration: {
      dist: './src/locale/enum',
    },
    projects: [
      {
        'id': process.env.LOKALISE_PROJECT_ID,
      },
    ],
  },
};
