#!/usr/bin/env node

const { runAdd, print } = require('./i18n-workflow');

if (require.main === module) {
  runAdd()
    .then(print)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
