const path = require('path');
const result = require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

if (result.error) {
  throw result.error;
}
