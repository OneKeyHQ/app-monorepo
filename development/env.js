const path = require('path');
const dotenv = require('dotenv');
const dateFns = require('date-fns');

const results = [
  dotenv.config({
    path: [
      // priority: high -> low
      path.resolve(__dirname, '../.env.version'),
      path.resolve(__dirname, '../.env.expo'),
      path.resolve(__dirname, '../.env'),
    ],
  }),
];

if (process.env.NODE_ENV !== 'production') {
  // console.log('process.env', process.env);

  process.env.BUILD_NUMBER =
    process.env.BUILD_NUMBER || `${dateFns.format(Date.now(), 'MMddHHmm')}-dev`;
}

process.env.BUILD_TIME = Date.now();

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
