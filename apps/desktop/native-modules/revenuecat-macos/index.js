// oxlint-disable onekey/no-raw-error -- This standalone native wrapper cannot import the application runtime.
const path = require('node:path');

let binding;

function isAvailable() {
  if (process.platform !== 'darwin') {
    return false;
  }
  try {
    binding ||= require(path.join(__dirname, 'revenuecat.node'));
    return typeof binding.invoke === 'function';
  } catch {
    return false;
  }
}

async function invoke(method, params = {}) {
  if (process.platform !== 'darwin') {
    throw new Error('RevenueCat Apple purchases require macOS');
  }
  binding ||= require(path.join(__dirname, 'revenuecat.node'));
  const response = JSON.parse(
    await binding.invoke(JSON.stringify({ method, params })),
  );
  if (response.error) {
    const error = new Error(response.error.message);
    Object.assign(error, response.error);
    throw error;
  }
  return response.result;
}

module.exports = { invoke, isAvailable };
