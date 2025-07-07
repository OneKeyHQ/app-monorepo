// https://github.com/inexorabletash/text-encoding
const encoding = require('./lib/encoding.js');

export default {
  TextEncoder: encoding.TextEncoder,
  TextDecoder: encoding.TextDecoder,
};