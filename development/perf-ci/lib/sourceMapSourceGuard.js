const fs = require('fs');
const path = require('path');

function normalizeSource(source) {
  return source
    .replace(/^webpack:\/\/(?:[^/]+\/)?\/?/, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '');
}

function categorizeModule(source) {
  if (source.includes('node_modules/')) return 'node_modules';
  if (source.includes('packages/components/')) return 'components';
  if (source.includes('packages/kit-bg/')) return 'kit-bg';
  if (source.includes('packages/kit/')) return 'kit';
  if (source.includes('packages/shared/')) return 'shared';
  if (source.includes('apps/web/')) return 'apps/web';
  return 'other';
}

function getPackageName(source) {
  const marker = 'node_modules/';
  const index = source.indexOf(marker);
  if (index < 0) return null;
  const parts = source.slice(index + marker.length).split('/');
  if (!parts[0]) return null;
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function getModuleRows({ buildDir, scriptFiles }) {
  const modules = new Map();
  for (const file of scriptFiles) {
    const mapPath = path.join(buildDir, `${file}.map`);
    if (fs.existsSync(mapPath)) {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      const sources = map.sources || [];
      const contents = map.sourcesContent || [];
      for (let index = 0; index < sources.length; index += 1) {
        const source = normalizeSource(sources[index]);
        const bytes = Buffer.byteLength(contents[index] || '');
        const existing = modules.get(source);
        if (existing) {
          existing.bytes = Math.max(existing.bytes, bytes);
          existing.files.add(file);
        } else {
          modules.set(source, {
            source,
            bytes,
            category: categorizeModule(source),
            packageName: getPackageName(source),
            files: new Set([file]),
          });
        }
      }
    }
  }

  return [...modules.values()].map((module) => ({
    ...module,
    files: [...module.files],
  }));
}

function getMissingSourceMaps({ buildDir, scriptFiles }) {
  return scriptFiles.filter(
    (file) => !fs.existsSync(path.join(buildDir, `${file}.map`)),
  );
}

function getScriptFilesFromUrls({ buildDir, scriptUrls }) {
  const normalizedBuildDir = path.resolve(buildDir);
  const scriptFiles = new Set();

  for (const scriptUrl of scriptUrls) {
    let pathname = '';
    try {
      pathname = decodeURIComponent(new URL(scriptUrl).pathname);
    } catch {
      pathname = '';
    }
    if (pathname) {
      const relativePath = pathname.replace(/^\/+/, '');
      const resolvedPath = path.resolve(buildDir, relativePath);
      if (
        resolvedPath.startsWith(`${normalizedBuildDir}${path.sep}`) &&
        fs.existsSync(resolvedPath)
      ) {
        scriptFiles.add(relativePath.replaceAll('\\', '/'));
      }
    }
  }

  return [...scriptFiles].toSorted();
}

function findForbiddenModules({ moduleRows, forbiddenSources }) {
  return moduleRows.filter((row) =>
    forbiddenSources.some((pattern) => row.source.includes(pattern)),
  );
}

module.exports = {
  findForbiddenModules,
  getMissingSourceMaps,
  getModuleRows,
  getScriptFilesFromUrls,
};
