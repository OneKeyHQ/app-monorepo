const fs = require('fs');

// the type check in p2tr causes psbt tx parsing to fail
// most wallets currently use this method to temporarily solve this problem
const fixPsbtSignatureError = () => {
  const file = './node_modules/bitcoinjs-lib/src/payments/p2tr.js';
  let fileData = fs.readFileSync(file).toString();
  fileData = fileData.replace(
    'signature: types_1.typeforce.maybe(types_1.typeforce.BufferN(64))',
    'signature: types_1.typeforce.maybe(types_1.typeforce.Buffer)',
  );
  fs.writeFileSync(file, fileData);
};

const run = async () => {
  let success = true;
  try {
    fixPsbtSignatureError();
  } catch (e) {
    console.error('error:', e.message);
    success = false;
  } finally {
    console.log('Fix modules result: ', success ? 'success' : 'failed');
  }
};

run();
