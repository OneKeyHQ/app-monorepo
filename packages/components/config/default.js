const result = require('dotenv').config({ path: '../../.env' });

if (result.error) {
  throw result.error;
}

module.exports = {
  translations: {
    dist: './src/locale/',
    token: process.env.LOKALISE_TOKEN,
    projects: [
      {
        'id': process.env.LOKALISE_PROJECT_ID,
      },
    ],
  },
};
