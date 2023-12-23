/* eslint-disable spellcheck/spell-checker */
/* eslint-disable import/no-dynamic-require */
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const parser = require('@babel/parser');
const { default: traverse } = require('@babel/traverse');
const { default: generate } = require('@babel/generator');
const { fileToIdMap } = require('./map');

const baseJSBundle = require(path.resolve(
  __dirname,
  '../../../node_modules',
  'metro/src/DeltaBundler/Serializers/baseJSBundle',
));
const bundleToString = require(path.resolve(
  __dirname,
  '../../../node_modules',
  'metro/src/lib/bundleToString',
));

const getContentHash = (content) => {
  const md5 = crypto.createHash('md5');
  md5.update(content);
  return md5.digest('hex');
};

const chunkModuleIdToHashMapPath = path.join(
  __dirname,
  './chunkModuleIdToHashMap.js',
);
const mainModuleId = 'main';

const asyncFlag = 'async';
const minSize = 0;
const chunkHashLength = 20;
const outputChunkDir = path.resolve(__dirname, '../dist/chunks');
fs.remove(outputChunkDir);
module.exports = async (entryPoint, prepend, graph, bundleOptions) => {
  const map = new Map([
    [
      mainModuleId,
      {
        moduleIds: new Set([]),
        modules: [],
      },
    ],
  ]);
  const chunkModuleIdToHashMap = {};
  const outputChunkFns = [];

  const findAllocationById = (fatherId) => {
    for (const [key, val] of map) {
      if (key !== mainModuleId) {
        if (val.moduleIds.has(fatherId)) {
          return key;
        }
      }
    }
    return null;
  };

  for (const [key, value] of graph.dependencies) {
    const asyncTypes = [...value.inverseDependencies].map((absolutePath) => {
      const moduleId = fileToIdMap.get(absolutePath);
      const val = graph.dependencies.get(absolutePath);
      for (const [k, v] of val.dependencies) {
        if (v.absolutePath === key) {
          const chunkModuleId = findAllocationById(moduleId);
          if (chunkModuleId && v.data.data.asyncType === null) {
            return chunkModuleId;
          }
          return v.data.data.asyncType;
        }
      }
      return undefined;
    });

    const moduleId = fileToIdMap.get(key);
    if (asyncTypes.length === 0 || asyncTypes.some((v) => v === null)) {
      map.get(mainModuleId).moduleIds.add(moduleId);
    } else if (asyncTypes.every((v) => v === asyncFlag)) {
      map.set(moduleId, {
        moduleIds: new Set([moduleId]),
        modules: [],
      });
    } else if (asyncTypes.length === 1) {
      map.get(asyncTypes[0]).moduleIds.add(moduleId);
    } else {
      map.get(mainModuleId).moduleIds.add(moduleId);
    }
  }

  const { pre, post, modules } = baseJSBundle(
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  );

  const allocation = () => {
    for (const [key, val] of map) val.modules.length = 0;
    for (const [moduleId, moduleCode] of modules) {
      for (const [key, val] of map) {
        if (val.moduleIds.has(moduleId)) {
          val.modules.push([moduleId, moduleCode]);
          break;
        }
      }
    }
  };

  allocation();

  for (const [key, val] of map) {
    if (key !== mainModuleId) {
      const totalByteLength = val.modules.reduce(
        (b, [moduleId, moduleCode]) => b + Buffer.byteLength(moduleCode),
        0,
      );
      if (totalByteLength < minSize) {
        // non't break up
        const main = map.get(mainModuleId);
        main.moduleIds = new Set([...main.moduleIds, ...val.moduleIds]);
        map.delete(key);
      }
    }
  }

  allocation();
  if (map.size >= 2) {
    await fs.ensureDir(outputChunkDir);
  }
  for (const [key, val] of map) {
    if (key !== mainModuleId) {
      const { code } = bundleToString({
        pre: '',
        post: '',
        modules: val.modules,
      });
      const hash = getContentHash(Buffer.from(code)).substring(
        0,
        chunkHashLength,
      );
      if (chunkModuleIdToHashMap[key] === undefined) {
        chunkModuleIdToHashMap[key] = {};
      }
      chunkModuleIdToHashMap[key] = { ...chunkModuleIdToHashMap[key], hash };
      outputChunkFns.push(
        (async () => {
          const dir = path.resolve(outputChunkDir, `${hash}.bundle`);
          await fs.writeFile(dir, code);
          console.log(`info Writing chunk bundle output to: ${dir}`);
        })(),
      );
    }
  }
  await Promise.all(outputChunkFns);

  for (const arr of map.get(mainModuleId).modules) {
    if (arr[0] === fileToIdMap.get(chunkModuleIdToHashMapPath)) {
      const idHashMap = Object.keys(chunkModuleIdToHashMap).reduce(
        (prev, key) => {
          prev[key] = chunkModuleIdToHashMap[key].hash;
          return prev;
        },
        {},
      );
      const ast = parser.parse(arr[1]);
      traverse(ast, {
        FunctionExpression(nodePath) {
          nodePath
            .get('body.body.0')
            .get('expression')
            .get('right')
            .replaceWithSourceString(JSON.stringify(idHashMap));
        },
      });
      const { code } = generate(ast, { minified: true });
      arr[1] = code;
      break;
    }
  }

  return bundleToString({
    pre,
    post,
    modules: map.get(mainModuleId).modules,
  });
};
