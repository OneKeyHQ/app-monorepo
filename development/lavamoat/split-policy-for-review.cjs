// cspell:ignore LavaMoat builtin builtins lavamoat

const fs = require('fs');
const path = require('path');

const { mergePolicy } = require('lavamoat-core');

const { LavaMoatError } = require('./error.cjs');
const { disabledTargetDirs, enabledTargets } = require('./targets.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const lavamoatRoot = path.join(repoRoot, 'lavamoat');
const reviewRoot = path.join(lavamoatRoot, 'review');

const riskRules = [
  {
    category: 'network',
    description: '可发起网络请求或跨上下文加载脚本的浏览器 API',
    globals: [
      /^fetch$/,
      /^globalThis\.fetch$/,
      /^XMLHttpRequest(?:\.|$)/,
      /^WebSocket(?:\.|$)/,
      /^EventSource(?:\.|$)/,
      /^navigator\.sendBeacon$/,
      /^importScripts$/,
    ],
  },
  {
    category: 'storage-privacy',
    description: '浏览器存储、剪贴板、cookie、文件读取等隐私相关 API',
    globals: [
      /^localStorage(?:\.|$)/,
      /^sessionStorage(?:\.|$)/,
      /^indexedDB(?:\.|$)/,
      /^mozIndexedDB$/,
      /^msIndexedDB$/,
      /^OIndexedDB$/,
      /^webkitIndexedDB$/,
      /^caches(?:\.|$)/,
      /^CacheStorage(?:\.|$)/,
      /^document\.cookie$/,
      /^cookieStore(?:\.|$)/,
      /^navigator\.clipboard(?:\.|$)/,
      /^navigator\.permissions(?:\.|$)/,
      /^Clipboard(?:\.|$)/,
      /^ClipboardItem(?:\.|$)/,
      /^clipboardData(?:\.|$)/,
      /^FileReader(?:\.|$)/,
    ],
  },
  {
    category: 'extension-desktop-bridge',
    description: '浏览器插件、Electron、Desktop bridge 等跨权限边界 API',
    globals: [
      /^chrome(?:\.|$)/,
      /^browser(?:\.|$)/,
      /^desktopApi(?:\.|$)/,
      /^desktopApiBridge(?:\.|$)/,
      /^desktopApiProxy(?:\.|$)/,
      /^ipcRenderer(?:\.|$)/,
      /^electron(?:\.|$)/,
      /^__SENTRY_IPC__$/,
      /^window\.desktopApi(?:\.|$)/,
    ],
  },
  {
    category: 'hardware-device',
    description: 'USB、HID、Bluetooth、摄像头、地理位置等设备访问能力',
    globals: [
      /^navigator\.usb(?:\.|$)/,
      /^navigator\.hid(?:\.|$)/,
      /^navigator\.bluetooth(?:\.|$)/,
      /^navigator\.serial(?:\.|$)/,
      /^navigator\.mediaDevices(?:\.|$)/,
      /^navigator\.geolocation(?:\.|$)/,
      /^NDEFReader(?:\.|$)/,
      /^USB(?:\.|$)/,
      /^HID(?:\.|$)/,
      /^Bluetooth(?:\.|$)/,
      /^MediaDevices(?:\.|$)/,
      /^Geolocation(?:\.|$)/,
      /^process\.env\.NODE_USB_PATH$/,
    ],
  },
  {
    category: 'crypto-random',
    description: '加密、随机数、密钥相关 API',
    globals: [
      /^crypto$/,
      /^crypto\./,
      /^globalThis\.crypto(?:\.|$)/,
      /^SubtleCrypto(?:\.|$)/,
      /^CryptoKey(?:\.|$)/,
    ],
  },
  {
    category: 'code-execution',
    description: '动态代码执行、worker、WebAssembly 等执行能力',
    globals: [
      /^eval$/,
      /^Function$/,
      /^globalThis\.Function$/,
      /^Worker(?:\.|$)/,
      /^SharedWorker(?:\.|$)/,
      /^ServiceWorker(?:\.|$)/,
      /^WebAssembly(?:\.|$)/,
    ],
  },
  {
    category: 'dom-injection-navigation',
    description: 'DOM 注入、HTML 解析、顶层跳转、opener/parent/top 等导航能力',
    globals: [
      /^document\.write$/,
      /^document\.writeln$/,
      /^document\.createElement$/,
      /^document\.createRange$/,
      /^DOMParser(?:\.|$)/,
      /(?:^|\.)innerHTML$/,
      /(?:^|\.)outerHTML$/,
      /^location(?:\.|$)/,
      /^history(?:\.|$)/,
      /^open$/,
      /^window\.open$/,
      /^top(?:\.|$)/,
      /^parent(?:\.|$)/,
    ],
  },
  {
    category: 'node-system',
    description: 'Node.js 系统 builtin 和 native module 能力',
    globals: [],
    builtins: [
      /^child_process(?:\.|$)/,
      /^node:child_process(?:\.|$)/,
      /^fs(?:\.|$)/,
      /^node:fs(?:\.|$)/,
      /^net(?:\.|$)/,
      /^node:net(?:\.|$)/,
      /^tls(?:\.|$)/,
      /^node:tls(?:\.|$)/,
      /^http(?:\.|$)/,
      /^node:http(?:\.|$)/,
      /^https(?:\.|$)/,
      /^node:https(?:\.|$)/,
      /^worker_threads(?:\.|$)/,
      /^node:worker_threads(?:\.|$)/,
      /^vm(?:\.|$)/,
      /^node:vm(?:\.|$)/,
    ],
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function toPosixPath(file) {
  return file.split(path.sep).join('/');
}

function matches(value, rules = []) {
  return rules.some((rule) => rule.test(value));
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}

function isAllowedPolicyValue(value) {
  return value !== false;
}

function findRiskCategory(type, name) {
  if (type === 'native') {
    return 'node-system';
  }

  for (const rule of riskRules) {
    if (type === 'global' && matches(name, rule.globals)) {
      return rule.category;
    }
    if (type === 'builtin' && matches(name, rule.builtins)) {
      return rule.category;
    }
  }

  return undefined;
}

function collectDeniedOverrides(overridePolicy, policy) {
  const denied = [];
  const overrideResources = overridePolicy.resources || {};
  const policyResources = policy.resources || {};

  for (const [resourceName, overrideResource] of Object.entries(
    overrideResources,
  )) {
    const policyResource = policyResources[resourceName] || {};
    const dictFields = [
      ['globals', 'global'],
      ['builtin', 'builtin'],
      ['builtins', 'builtin'],
      ['packages', 'package'],
    ];

    for (const [field, type] of dictFields) {
      for (const [name, value] of Object.entries(
        overrideResource[field] || {},
      )) {
        if (value === false) {
          denied.push({
            resource: resourceName,
            type,
            field,
            name,
            category: findRiskCategory(type, name),
            generatedValue: policyResource[field]?.[name],
            effectiveValue: false,
          });
        }
      }
    }

    for (const [field, type, name] of [
      ['native', 'native', 'native'],
      ['env', 'env', 'env'],
    ]) {
      if (overrideResource[field] === false) {
        denied.push({
          resource: resourceName,
          type,
          field,
          name,
          category: findRiskCategory(type, name),
          generatedValue: policyResource[field],
          effectiveValue: false,
        });
      }
    }
  }

  return denied.toSorted((left, right) => {
    return (
      left.resource.localeCompare(right.resource) ||
      left.type.localeCompare(right.type) ||
      left.name.localeCompare(right.name)
    );
  });
}

function getPolicyFiles() {
  const policyFiles = enabledTargets.map((target) =>
    path.join(lavamoatRoot, target.policy),
  );
  const missingPolicyFiles = policyFiles.filter((file) => !fs.existsSync(file));

  if (missingPolicyFiles.length > 0) {
    throw new LavaMoatError(
      `Missing enabled LavaMoat policies:\n${missingPolicyFiles
        .map((file) => path.relative(repoRoot, file))
        .join('\n')}`,
    );
  }

  return policyFiles;
}

function analyzePolicy(policyFile) {
  const policy = readJson(policyFile);
  const overrideFile = path.join(
    path.dirname(policyFile),
    'policy-override.json',
  );
  const overridePolicy = fs.existsSync(overrideFile)
    ? readJson(overrideFile)
    : { resources: {} };
  const effectivePolicy = mergePolicy(policy, overridePolicy);
  const resources = effectivePolicy.resources || {};
  const deniedOverrides = collectDeniedOverrides(overridePolicy, policy);
  const relativePolicyDir = path.dirname(
    path.relative(lavamoatRoot, policyFile),
  );
  const outputDir = path.join(reviewRoot, relativePolicyDir);

  const categorized = Object.fromEntries(
    riskRules.map((rule) => [
      rule.category,
      {
        description: rule.description,
        resources: {},
      },
    ]),
  );
  const highRiskResourceNames = new Set();
  const allHighRiskEntries = [];
  const builtinEntries = [];
  const nativeEntries = [];

  for (const [resourceName, resourcePolicy] of Object.entries(resources)) {
    const globals = resourcePolicy.globals || {};
    const builtins = {
      ...resourcePolicy.builtin,
      ...resourcePolicy.builtins,
    };

    for (const [globalName, value] of Object.entries(globals)) {
      if (isAllowedPolicyValue(value)) {
        for (const rule of riskRules) {
          if (matches(globalName, rule.globals)) {
            const category = categorized[rule.category];
            category.resources[resourceName] ||= { globals: {} };
            category.resources[resourceName].globals[globalName] = value;
            highRiskResourceNames.add(resourceName);
            allHighRiskEntries.push({
              category: rule.category,
              resource: resourceName,
              type: 'global',
              name: globalName,
              value,
            });
          }
        }
      }
    }

    for (const [builtinName, value] of Object.entries(builtins)) {
      if (isAllowedPolicyValue(value)) {
        for (const rule of riskRules) {
          if (matches(builtinName, rule.builtins)) {
            const category = categorized[rule.category];
            category.resources[resourceName] ||= { builtins: {} };
            category.resources[resourceName].builtins[builtinName] = value;
            highRiskResourceNames.add(resourceName);
            const entry = {
              category: rule.category,
              resource: resourceName,
              type: 'builtin',
              name: builtinName,
              value,
            };
            builtinEntries.push(entry);
            allHighRiskEntries.push(entry);
          }
        }
      }
    }

    if (resourcePolicy.native) {
      highRiskResourceNames.add(resourceName);
      const entry = {
        category: 'node-system',
        resource: resourceName,
        type: 'native',
        name: 'native',
        value: resourcePolicy.native,
      };
      nativeEntries.push(entry);
      allHighRiskEntries.push(entry);
    }
  }

  const packageEdgesToRiskyResources = {};
  for (const [resourceName, resourcePolicy] of Object.entries(resources)) {
    const packages = resourcePolicy.packages || {};
    for (const [targetResource, value] of Object.entries(packages)) {
      if (
        isAllowedPolicyValue(value) &&
        highRiskResourceNames.has(targetResource)
      ) {
        packageEdgesToRiskyResources[resourceName] ||= {};
        packageEdgesToRiskyResources[resourceName][targetResource] = value;
      }
    }
  }

  const categoryCounts = {};
  for (const [category, report] of Object.entries(categorized)) {
    categoryCounts[category] = {
      resources: Object.keys(report.resources).length,
      entries: Object.values(report.resources).reduce((sum, item) => {
        return (
          sum +
          Object.keys(item.globals || {}).length +
          Object.keys(item.builtins || {}).length
        );
      }, 0),
    };
    writeJson(path.join(outputDir, `${category}.json`), sortObject(report));
  }

  writeJson(
    path.join(outputDir, 'all-high-risk-entries.json'),
    sortObject(allHighRiskEntries),
  );
  writeJson(
    path.join(outputDir, 'node-builtins.json'),
    sortObject(builtinEntries),
  );
  writeJson(
    path.join(outputDir, 'native-modules.json'),
    sortObject(nativeEntries),
  );
  writeJson(
    path.join(outputDir, 'denied-overrides.json'),
    sortObject(deniedOverrides),
  );
  writeJson(
    path.join(outputDir, 'package-edges-to-risky-resources.json'),
    sortObject(packageEdgesToRiskyResources),
  );

  const summary = {
    sourcePolicy: toPosixPath(path.relative(repoRoot, policyFile)),
    sourceOverride: toPosixPath(path.relative(repoRoot, overrideFile)),
    reviewMode: 'effective-policy',
    totalResources: Object.keys(resources).length,
    generatedResources: Object.keys(policy.resources || {}).length,
    highRiskResources: highRiskResourceNames.size,
    highRiskEntries: allHighRiskEntries.length,
    deniedOverrides: deniedOverrides.length,
    categoryCounts,
    packageEdgesToRiskyResources: Object.values(
      packageEdgesToRiskyResources,
    ).reduce((sum, edges) => sum + Object.keys(edges).length, 0),
  };
  writeJson(
    path.join(outputDir, 'effective-policy-summary.json'),
    sortObject(summary),
  );
  writeJson(path.join(outputDir, 'summary.json'), sortObject(summary));
  return summary;
}

fs.rmSync(reviewRoot, { recursive: true, force: true });
const policyFiles = getPolicyFiles();
const summaries = policyFiles.map(analyzePolicy);

writeJson(path.join(reviewRoot, 'summary.json'), {
  policies: summaries,
  totalPolicies: summaries.length,
});

console.log(
  `Generated LavaMoat review files for ${summaries.length} policies.`,
);
