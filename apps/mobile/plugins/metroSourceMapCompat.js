const { toBabelSegments, toSegmentTuple } = require('metro-source-map');

const normalizeMap = (map) => {
  if (map === null || map === undefined || Array.isArray(map)) {
    return map;
  }

  const parsedMap = typeof map === 'string' ? JSON.parse(map) : map;
  if (
    typeof parsedMap !== 'object' ||
    parsedMap === null ||
    typeof parsedMap.version !== 'number' ||
    (typeof parsedMap.mappings !== 'string' &&
      !Array.isArray(parsedMap.sections))
  ) {
    return [];
  }
  return toBabelSegments(parsedMap).map(toSegmentTuple);
};

const normalizeModulesForSourceMap = (modules) => {
  modules.forEach((module) => {
    module.output?.forEach((output) => {
      const map = output.data?.map;
      if (map !== null && map !== undefined && !Array.isArray(map)) {
        output.data.map = normalizeMap(map);
      }
    });
  });
  return modules;
};

module.exports = {
  normalizeMap,
  normalizeModulesForSourceMap,
};
