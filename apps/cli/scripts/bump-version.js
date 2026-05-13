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

// Keep platform subpackages in lockstep with the main package.
// cli-publish.yml refuses to publish the main package unless every listed
// optional platform subpackage exists at the same version, so any drift here
// will block release.
const PLATFORM_SUBPKG = /^@onekeyfe\/cli-(darwin|linux|win32)-/;
if (pkg.optionalDependencies) {
  for (const dep of Object.keys(pkg.optionalDependencies)) {
    if (PLATFORM_SUBPKG.test(dep)) {
      pkg.optionalDependencies[dep] = pkg.version;
    }
  }
}

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(pkg.version);
