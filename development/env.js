const path = require('path');
const dotenv = require('dotenv');

const results = [
  dotenv.config({
    path: path.resolve(__dirname, '../.env'),
  }),
  dotenv.config({
    path: path.resolve(__dirname, '../.env.version'),
  }),
];

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
