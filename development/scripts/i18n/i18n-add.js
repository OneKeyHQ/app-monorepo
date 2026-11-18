#!/usr/bin/env node

const { loadLocalSettings } = require('./central');
const { runAdd, print } = require('./i18n-workflow');

if (require.main === module) {
  loadLocalSettings();
  runAdd()
    .then(print)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
