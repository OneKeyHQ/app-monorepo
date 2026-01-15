const { execSync } = require('child_process');
const { exit } = require('process');
const fs = require('fs');
const path = require('path');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] Package versions check started...`);

const getDuration = () => ((Date.now() - startTime) / 1000).toFixed(2);

// Find all workspace package.json files (excluding node_modules)
function findPackageJsonFiles(rootDir) {
  const result = execSync(
    `find "${rootDir}" -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*"`,
    { encoding: 'utf-8' },
  );
  return result
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);
}

// Extract all dependencies from a package.json
function extractDependencies(packageJsonPath) {
  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content);

  const deps = {};
  const depTypes = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const depType of depTypes) {
    if (pkg[depType]) {
      for (const [name, version] of Object.entries(pkg[depType])) {
        if (!deps[name]) {
          deps[name] = [];
        }
        deps[name].push({
          version,
          depType,
          file: packageJsonPath,
        });
      }
    }
  }

  return deps;
}

// Normalize version for comparison (handle workspace:*, *, etc.)
function normalizeVersion(version) {
  // Skip workspace references and wildcards
  if (
    version === '*' ||
    version === 'workspace:*' ||
    version.startsWith('workspace:')
  ) {
    return null;
  }
  return version;
}

// Check if two versions are considered different (ignoring special versions)
function areVersionsDifferent(versions) {
  const normalizedVersions = versions
    .map((v) => normalizeVersion(v.version))
    .filter((v) => v !== null);

  if (normalizedVersions.length <= 1) {
    return false;
  }

  const uniqueVersions = [...new Set(normalizedVersions)];
  return uniqueVersions.length > 1;
}

function main() {
  const rootDir = path.resolve(__dirname, '../..');

  console.log('Checking package version consistency...\n');

  // Find all package.json files
  const packageJsonFiles = findPackageJsonFiles(rootDir);
  console.log(`Found ${packageJsonFiles.length} package.json files\n`);

  // Collect all dependencies from all files
  const allDeps = {};

  for (const file of packageJsonFiles) {
    try {
      const deps = extractDependencies(file);
      for (const [name, entries] of Object.entries(deps)) {
        if (!allDeps[name]) {
          allDeps[name] = [];
        }
        allDeps[name].push(...entries);
      }
    } catch (error) {
      console.error(`Error parsing ${file}: ${error.message}`);
    }
  }

  // Find packages with inconsistent versions
  const inconsistencies = [];

  for (const [pkgName, entries] of Object.entries(allDeps)) {
    if (entries.length > 1 && areVersionsDifferent(entries)) {
      // Filter out workspace references for reporting
      const relevantEntries = entries.filter(
        (e) => normalizeVersion(e.version) !== null,
      );

      if (relevantEntries.length > 1) {
        const uniqueVersions = [
          ...new Set(relevantEntries.map((e) => e.version)),
        ];
        if (uniqueVersions.length > 1) {
          inconsistencies.push({
            package: pkgName,
            entries: relevantEntries,
          });
        }
      }
    }
  }

  // Report results
  if (inconsistencies.length === 0) {
    console.log('✓ All package versions are consistent!\n');
    console.log(
      `[${getTimestamp()}] Package versions check completed. (${getDuration()}s)`,
    );
    exit(0);
  }

  console.log(
    `✖ Found ${inconsistencies.length} package(s) with inconsistent versions:\n`,
  );

  for (const { package: pkgName, entries } of inconsistencies) {
    console.log(`Package: ${pkgName}`);

    // Group by version
    const byVersion = {};
    for (const entry of entries) {
      if (!byVersion[entry.version]) {
        byVersion[entry.version] = [];
      }
      byVersion[entry.version].push(entry);
    }

    for (const [version, versionEntries] of Object.entries(byVersion)) {
      console.log(`  Version: ${version}`);
      for (const entry of versionEntries) {
        const relativePath = path.relative(rootDir, entry.file);
        console.log(`    - ${relativePath} (${entry.depType})`);
      }
    }
    console.log('');
  }

  console.log(
    'Please ensure all packages use consistent versions across the monorepo.',
  );
  exit(1);
}

main();
