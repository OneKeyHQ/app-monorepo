const MYSTEN_SUI_PREFIX = '@mysten/sui/';

function resolveMystenSuiSubpathExport(moduleName, monorepoRoot) {
  if (!moduleName.startsWith(MYSTEN_SUI_PREFIX)) {
    return null;
  }

  const subpath = moduleName.slice(MYSTEN_SUI_PREFIX.length);
  if (!subpath || subpath.includes('..')) {
    return null;
  }

  try {
    return require.resolve(moduleName, { paths: [monorepoRoot] });
  } catch {
    return null;
  }
}

module.exports = {
  resolveMystenSuiSubpathExport,
};
