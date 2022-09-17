const fs = require('fs');
const iosstatsjson = require('../packages/app/stats.json');

const { files } = iosstatsjson.results[0];

const assets = Object.keys(files).map((fn) => {
  const { size } = files[fn];
  return { name: fn, size };
});

fs.writeFileSync(
  './packages/app/stats.json',
  JSON.stringify({ assets }, null, 2),
);
