#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const semver = require('semver');

const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const type = process.argv[2];

const valid = ['patch', 'minor', 'major', 'alpha', 'beta'];
if (!valid.includes(type)) {
  console.error(`Usage: node bump-version.js <${valid.join('|')}>`);
  process.exit(1);
}

const release = type === 'alpha' || type === 'beta' ? 'prerelease' : type;
const preid = type === 'alpha' || type === 'beta' ? type : undefined;

pkg.version = semver.inc(pkg.version, release, preid);
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(pkg.version);
