const fs = require('fs');
const path = require('path');

const base = __dirname;
const files = fs.readdirSync(base).filter((file) => file.endsWith('.json'));

files.forEach((file) => {
  try {
    fs.unlinkSync(path.join(base, file));
  } catch (error) {
    console.log(error);
  }
});
