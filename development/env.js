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

console.log('----------------------------------------------');
console.log('process.env.VERSION=', process.env.VERSION);
console.log('process.env.BUILD_NUMBER=', process.env.BUILD_NUMBER);
console.log('----------------------------------------------');

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
