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
];

if (process.env.NODE_ENV !== 'production') {
  process.env.BUILD_NUMBER =
    process.env.BUILD_NUMBER || `${dateFns.format(Date.now(), 'MMddHHmm')}-dev`;
}

console.log('----------------------------------------------');
console.log('process.env.VERSION=', process.env.VERSION);
console.log('process.env.BUILD_NUMBER=', process.env.BUILD_NUMBER);
console.log('----------------------------------------------');

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
