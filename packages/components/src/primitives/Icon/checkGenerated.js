const { buildIcons } = require('./script');

void buildIcons({ check: true }).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
