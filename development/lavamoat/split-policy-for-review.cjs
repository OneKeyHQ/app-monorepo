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

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${value.trimEnd()}\n`);
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

function categoryCell(summary, category) {
  const count = summary.categoryCounts[category] || {
    resources: 0,
    entries: 0,
  };
  return `${count.resources}/${count.entries}`;
}

function getTargetLabel(id) {
  return enabledTargets.find((target) => target.id === id)?.label || id;
}

function createReviewIndex(summaries) {
  const categoryLabels = {
    network: 'network',
    'storage-privacy': 'storage/privacy',
    'extension-desktop-bridge': 'extension/desktop bridge',
    'hardware-device': 'hardware/device',
    'crypto-random': 'crypto/random',
    'code-execution': 'code execution',
    'dom-injection-navigation': 'DOM/navigation',
    'node-system': 'Node system',
  };
  const lines = [
    '# LavaMoat Policy Review Index',
    '',
    '本文件由 `yarn lavamoat:review` 生成，用于 PR review 时快速定位高风险权限分类。不要手工编辑。',
    '',
    '`review/` 目录中的高风险分类文件基于 `policy.json` 与同目录 `policy-override.json` merge 后的有效 policy 生成；显式 deny 的 override 会从有效权限视图中移除，并单独写入 `denied-overrides.json`。',
    '',
    '## 当前范围',
    '',
    '当前启用目标：',
    '',
    ...enabledTargets.map((target) => `- \`${target.id}\`：${target.label}`),
    '',
    '当前暂缓目标，只允许保留空目录占位：',
    '',
    ...disabledTargetDirs.map((targetDir) => `- \`${targetDir}\``),
    '',
    '暂缓目标目录中的 `.gitkeep` 内容固定为 `placeholder`，避免 CI 生成的 policy diff patch 出现空白行警告。',
    '',
    '## Policy 摘要',
    '',
    '| 目标 | 说明 | Policy | 总资源 | 高风险资源 | 高风险条目 | 指向高风险资源的 package 边 |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
  ];

  for (const summary of summaries) {
    const policyRelativeToLavamoat = summary.sourcePolicy.replace(
      /^lavamoat\//,
      '',
    );
    const target = policyRelativeToLavamoat.replace(/\/policy\.json$/, '');
    lines.push(
      `| \`${target}\` | ${getTargetLabel(target)} | [policy](${policyRelativeToLavamoat}) | ${summary.totalResources} | ${summary.highRiskResources} | ${summary.highRiskEntries} | ${summary.packageEdgesToRiskyResources} |`,
    );
  }

  lines.push(
    '',
    '## 高风险分类统计',
    '',
    `| 目标 | ${riskRules
      .map((rule) => categoryLabels[rule.category] || rule.category)
      .join(' | ')} |`,
    `| --- | ${riskRules.map(() => '---:').join(' | ')} |`,
  );

  for (const summary of summaries) {
    const policyRelativeToLavamoat = summary.sourcePolicy.replace(
      /^lavamoat\//,
      '',
    );
    const target = policyRelativeToLavamoat.replace(/\/policy\.json$/, '');
    lines.push(
      `| \`${target}\` | ${riskRules
        .map((rule) => categoryCell(summary, rule.category))
        .join(' | ')} |`,
    );
  }

  lines.push(
    '',
    '## 高风险分类说明',
    '',
    '`resources/entries` 分别表示命中该分类的 LavaMoat resource 数量，以及这些 resources 中命中的 global/builtin/native 权限条目数量。',
    '',
    '`denied-overrides.json` 记录 `policy-override.json` 中显式设置为 `false` 的 global/builtin/package/native/env 条目。Review 时如果 raw `policy.json` 新增了高风险权限，但 override 显式 deny，需要同时确认 deny 的业务路径已经有测试覆盖，避免运行时才触发权限错误。',
    '',
    '| 分类 | 含义 |',
    '| --- | --- |',
  );

  for (const rule of riskRules) {
    lines.push(`| \`${rule.category}\` | ${rule.description} |`);
  }

  lines.push('', '## Review 文件', '');

  for (const summary of summaries) {
    const policyRelativeToLavamoat = summary.sourcePolicy.replace(
      /^lavamoat\//,
      '',
    );
    const target = policyRelativeToLavamoat.replace(/\/policy\.json$/, '');
    const reviewDir = path.dirname(policyRelativeToLavamoat);
    const link = (name) => toPosixPath(path.join('review', reviewDir, name));
    const categoryLinks = riskRules
      .map((rule) => `[${rule.category}](${link(`${rule.category}.json`)})`)
      .join(' / ');

    lines.push(
      `- \`${target}\`: [summary](${link('summary.json')}) / [effective-policy-summary](${link('effective-policy-summary.json')}) / [denied-overrides](${link('denied-overrides.json')}) / [all-high-risk-entries](${link('all-high-risk-entries.json')}) / ${categoryLinks} / [package-edges-to-risky-resources](${link('package-edges-to-risky-resources.json')})`,
    );
  }

  lines.push(
    '',
    '## PR 作者自查',
    '',
    '如果本 PR 修改了 `lavamoat/**/policy.json` 或 `lavamoat/review/**`，PR 作者需要先解释新增 package、新增强权限，以及不确定项，再请求 security reviewer 检查。',
    '',
    '重点优先看 `all-high-risk-entries.json` 和 `package-edges-to-risky-resources.json`：前者列出当前 policy 中命中的强权限，后者说明哪些 package 可以访问到带高风险能力的 resource。判断新增或变化时必须结合 PR 的 `git diff`，不要只看快照文件本身。',
    '',
    '可复制以下模板到 PR 评论中完成第一轮 review：',
    '',
    '```markdown',
    '## LavaMoat Policy Review',
    '',
    '### 变更来源',
    '',
    '- [ ] 新增或升级依赖',
    '- [ ] 业务代码 import 图变化',
    '- [ ] webpack / 构建配置变化',
    '- [ ] 重新生成 policy 后的稳定化变更',
    '',
    '### 新增 packages',
    '',
    '- package-a：预期引入，用于 ...',
    '- package-b：由 package-a 间接引入，用于 ...',
    '',
    '### 新增强权限',
    '',
    '- `network.json`：',
    '- `storage-privacy.json`：',
    '- `extension-desktop-bridge.json`：',
    '- `hardware-device.json`：',
    '- `crypto-random.json`：',
    '- `code-execution.json`：',
    '- `dom-injection-navigation.json`：',
    '- `node-system.json` / `native-modules.json`：',
    '',
    '### 风险判断',
    '',
    '- [ ] 新增权限和本 PR 业务目标一致',
    '- [ ] 没有 UI-only / 纯工具类依赖异常获得高风险能力',
    '- [ ] 不确定项已列出并需要 reviewer 判断：',
    '```',
  );

  return lines.join('\n');
}

fs.rmSync(reviewRoot, { recursive: true, force: true });
const policyFiles = getPolicyFiles();
const summaries = policyFiles.map(analyzePolicy);

writeJson(path.join(reviewRoot, 'summary.json'), {
  policies: summaries,
  totalPolicies: summaries.length,
});
writeText(path.join(lavamoatRoot, 'README.review.md'), createReviewIndex(summaries));

console.log(
  `Generated LavaMoat review files for ${summaries.length} policies.`,
);
