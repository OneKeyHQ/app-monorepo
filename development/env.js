const path = require('path');
const dotenv = require('dotenv');
const dateFns = require('date-fns');

const results = [
  dotenv.config({
    path: path.resolve(__dirname, '../.env'),
  }),
  dotenv.config({
    path: path.resolve(__dirname, '../.env.version'),
  }),
  dotenv.config({
    path: path.resolve(__dirname, '../.env.expo'),
  }),
];

if (process.env.NODE_ENV !== 'production') {
  process.env.BUILD_NUMBER =
    process.env.BUILD_NUMBER || `${dateFns.format(Date.now(), 'MMddHHmm')}-dev`;
}

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
