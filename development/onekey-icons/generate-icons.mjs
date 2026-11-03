/* cspell:words xlink */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRootDefault = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const outputRootDefault = path.join(
  appRootDefault,
  'development/generated/onekey-icons',
);
const formatTypeScript = async (source) => {
  const { format } = await import('oxfmt');
  const result = await format('assetUrls.ts', source, {
    printWidth: 80,
    quoteProps: 'preserve',
    singleQuote: true,
    trailingComma: 'all',
  });
  if (result.errors.length) throw new TypeError(result.errors.join(', '));
  return result.code;
};

const compare = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};
const fail = (message) => {
  throw new Error(message);
};
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');

export function loadTools(appRoot) {
  const appRequire = createRequire(
    path.join(appRoot, 'packages/components/package.json'),
  );
  const svgoRequire = createRequire(appRequire.resolve('@svgr/plugin-svgo'));
  if (svgoRequire('svgo/package.json').version !== '3.3.5')
    fail('Expected App svgo 3.3.5');
  return {
    parse: svgoRequire('svgo/lib/parser.js').parseSvg,
    stringify: svgoRequire('svgo/lib/stringifier.js').stringifySvg,
    camelCase: appRequire('lodash/camelCase'),
  };
}

// Classification only enables fast paths when visible paint semantics are proven.
export function classifyRecolor(root, currentColor) {
  if (currentColor === 0) return 'fixed';
  const shapes = new Set([
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
  ]);
  const attributes = new Set([
    'xmlns',
    'width',
    'height',
    'viewBox',
    'preserveAspectRatio',
    'id',
    'd',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'points',
    'fill',
    'stroke',
    'fill-rule',
    'clip-rule',
    'fill-opacity',
    'stroke-opacity',
    'opacity',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'transform',
  ]);
  let dynamic = 0,
    fixed = 0,
    ambiguous = false;
  const walk = (node, inherited, hidden = false) => {
    if (node.type !== 'element') return;
    if (!shapes.has(node.name) && !['svg', 'g'].includes(node.name))
      ambiguous = true;
    if (node !== root && node.name === 'svg') ambiguous = true;
    for (const [key, value] of Object.entries(node.attributes)) {
      if (!attributes.has(key) || /url\(/i.test(value)) ambiguous = true;
      if (
        ['fill', 'stroke'].includes(key) &&
        !/^(?:none|transparent|currentColor|inherit|black|white|#(?:[\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8}))$/.test(
          value,
        )
      )
        ambiguous = true;

      if (
        ['opacity', 'fill-opacity', 'stroke-opacity'].includes(key) &&
        !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value)
      )
        ambiguous = true;
    }
    const paint = { ...inherited };
    for (const key of [
      'fill',
      'stroke',
      'fill-opacity',
      'stroke-opacity',
      'stroke-width',
    ]) {
      if (
        node.attributes[key] !== undefined &&
        node.attributes[key] !== 'inherit'
      )
        paint[key] = node.attributes[key];
    }
    const invisible = hidden || Number(node.attributes.opacity ?? 1) === 0;
    if (shapes.has(node.name) && !invisible) {
      const paints = node.name === 'line' ? ['stroke'] : ['fill', 'stroke'];
      for (const key of paints) {
        const value = paint[key];
        const invisiblePaint =
          value === 'none' ||
          value === 'transparent' ||
          Number(paint[`${key}-opacity`]) === 0 ||
          (key === 'stroke' && Number(paint['stroke-width']) === 0);
        if (!invisiblePaint) {
          if (value === 'currentColor') dynamic += 1;
          else fixed += 1;
        }
      }
    }
    node.children.forEach((child) => walk(child, paint, invisible));
  };
  walk(root, {
    'fill': 'black',
    'stroke': 'none',
    'fill-opacity': '1',
    'stroke-opacity': '1',
    'stroke-width': '1',
  });
  if (ambiguous || (dynamic > 0 && fixed > 0)) return 'raster';
  if (dynamic === 0) return 'fixed';
  return dynamic === 1 ? 'single' : 'multiple';
}

export function compileSource(source, name, tools) {
  const ast = tools.parse(source, `${name}.svg`);
  const roots = ast.children.filter((node) => node.type === 'element');
  if (roots.length !== 1 || roots[0].name !== 'svg')
    fail(`${name}: expected SVG root`);
  const root = roots[0];
  if (
    root.attributes.xmlns !== undefined &&
    root.attributes.xmlns !== 'http://www.w3.org/2000/svg'
  )
    fail(`${name}: invalid namespace`);
  if (
    ast.children.some(
      (node) => !['element', 'comment', 'text'].includes(node.type),
    )
  )
    fail(`${name}: unsupported XML instruction/declaration`);
  const viewBox = root.attributes.viewBox?.trim().split(/[ ,]+/).map(Number);
  if (
    viewBox?.length !== 4 ||
    !viewBox.every(Number.isFinite) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  )
    fail(`${name}: invalid viewBox`);
  const ids = new Set();
  const refs = [];
  let currentColor = 0;
  const walk = (node) => {
    if (node.type !== 'element') return;
    if (
      ![
        'svg',
        'path',
        'rect',
        'circle',
        'ellipse',
        'line',
        'polyline',
        'g',
        'defs',
        'linearGradient',
        'radialGradient',
        'stop',
        'clipPath',
        'mask',
      ].includes(node.name)
    )
      fail(`${name}: unsupported element ${node.name}`);
    if (
      [
        'script',
        'style',
        'foreignObject',
        'image',
        'animate',
        'animateTransform',
        'set',
      ].includes(node.name)
    )
      fail(`${name}: unsupported active/external element ${node.name}`);
    for (const [key, value] of Object.entries(node.attributes)) {
      if (/^on/i.test(key) || key === 'style' || key === 'xml:base')
        fail(`${name}: unsafe attribute ${key}`);
      if (/currentColor/i.test(value)) {
        if (!['fill', 'stroke'].includes(key) || value !== 'currentColor')
          fail(`${name}: unsupported currentColor in ${key}`);
        currentColor += 1;
      }
      if (key === 'id') {
        if (!/^[A-Za-z_][\w:.-]*$/.test(value) || ids.has(value))
          fail(`${name}: invalid/duplicate ID ${value}`);
        ids.add(value);
      }
      if (key === 'href' || key === 'xlink:href') {
        if (!/^#[\w:.-]+$/.test(value)) fail(`${name}: external reference`);
        refs.push(value.slice(1));
      }
      if (/url\s*\(/i.test(value) && !/^url\(#[\w:.-]+\)$/.test(value))
        fail(`${name}: unsupported URL syntax`);
      for (const match of value.matchAll(/url\(([^)]+)\)/g)) {
        const ref = match[1].replace(/^['"]|['"]$/g, '');
        if (!/^#[\w:.-]+$/.test(ref)) fail(`${name}: external URL`);
        refs.push(ref.slice(1));
      }
    }
    node.children.forEach(walk);
  };
  walk(root);
  if (
    [...source.matchAll(/(?:fill|stroke)\s*=\s*["']currentColor["']/g)]
      .length !== currentColor
  )
    fail(`${name}: currentColor must use literal fill/stroke attribute tokens`);
  const missingReferences = [
    ...new Set(refs.filter((ref) => !ids.has(ref))),
  ].toSorted(compare);
  const recolorMode = classifyRecolor(root, currentColor);
  const raw = source.endsWith('\n') ? source : `${source}\n`;
  const prefix = `onekey-${name}-`;
  const namespace = (node) => {
    if (node.type !== 'element') return;
    for (const [key, value] of Object.entries(node.attributes)) {
      if (key === 'id') node.attributes[key] = prefix + value;
      else if (key === 'href' || key === 'xlink:href')
        node.attributes[key] = `#${prefix}${value.slice(1)}`;
      else
        node.attributes[key] = value.replace(
          /url\((['"]?)#([\w:.-]+)\1\)/g,
          `url(#${prefix}$2)`,
        );
    }
    node.children.forEach(namespace);
  };
  namespace(root);
  delete root.attributes.xmlns;
  delete root.attributes.width;
  delete root.attributes.height;
  root.name = 'symbol';
  root.attributes.id = `onekey-${name}`;
  return {
    raw,
    recolorMode,
    symbol: tools.stringify({ type: 'root', children: [root] }),
    viewBox,
    currentColor,
    digest: digest(raw),
    missingReferences,
  };
}

export async function generateOutputs(
  appRoot = appRootDefault,
  outputRoot = outputRootDefault,
) {
  const tools = loadTools(appRoot);
  const svgRoot = path.join(appRoot, 'packages/components/svg');
  const pascal = (value) => {
    const camel = tools.camelCase(value);
    return camel[0].toUpperCase() + camel.slice(1);
  };
  const entries = [];
  for (const directory of fs
    .readdirSync(svgRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .toSorted(compare)) {
    for (const file of fs
      .readdirSync(path.join(svgRoot, directory))
      .filter((item) => item.endsWith('.svg'))
      .toSorted(compare)) {
      const name = pascal(
        pascal(path.basename(file, '.svg')) + directory.toUpperCase(),
      );
      entries.push({ name, source: `${directory}/${file}` });
    }
  }
  entries.sort((a, b) => compare(a.name, b.name));
  if (
    new Set(entries.map((entry) => entry.name.toLowerCase())).size !==
    entries.length
  )
    fail('Duplicate canonical icon name');
  const outputs = new Map();
  const manifest = {};
  const urls = [];
  const diagnostics = [];
  for (const entry of entries) {
    const result = compileSource(
      fs.readFileSync(path.join(svgRoot, entry.source), 'utf8'),
      entry.name,
      tools,
    );
    outputs.set(
      path.join(outputRoot, 'native/icons', `${entry.name}.svg`),
      result.raw,
    );
    manifest[entry.name] = {
      source: entry.source,
      digest: result.digest,
      viewBox: result.viewBox,
      recolorMode: result.recolorMode,
    };
    if (result.missingReferences.length)
      diagnostics.push({
        name: entry.name,
        source: entry.source,
        missingReferences: result.missingReferences,
      });
    outputs.set(
      path.join(outputRoot, 'web/assets', `${entry.name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${result.symbol}</svg>\n`,
    );
    urls.push(
      `  ${entry.name}: () => new URL('./assets/${entry.name}.svg', import.meta.url).href,`,
    );
  }
  outputs.set(
    path.join(outputRoot, 'native/icons/manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  outputs.set(
    path.join(outputRoot, 'web/assetUrls.ts'),
    await formatTypeScript(
      `// Generated by development/onekey-icons/generate-icons.mjs; all canonical resources are retained.\nconst urls: Record<string, () => string> = {\n${urls.join(
        '\n',
      )}\n};\n\nexport function iconResourceHref(name: string): string | undefined {\n  const load = Object.prototype.hasOwnProperty.call(urls, name) ? urls[name] : undefined;\n  return load ? load() + '#onekey-' + name : undefined;\n}\n`,
    ),
  );
  return { outputs, count: entries.length, diagnostics };
}

export function writeOutputs(
  outputs,
  check = false,
  temporaryRoot = path.join(appRootDefault, '.tmp'),
) {
  const directories = new Set(
    [...outputs.keys()]
      .filter(
        (file) =>
          file.endsWith('.svg') || path.basename(file) === 'manifest.json',
      )
      .map(path.dirname),
  );
  const obsolete = [];
  for (const directory of [...directories].filter((entry) =>
    fs.existsSync(entry),
  )) {
    for (const name of fs
      .readdirSync(directory)
      .filter((entry) => !outputs.has(path.join(directory, entry)))) {
      const file = path.join(directory, name);
      if (!/^[A-Z][A-Za-z0-9]*\.svg$/.test(name))
        fail(`Unexpected generated icon resource: ${file}`);
      obsolete.push(file);
    }
  }
  const changed = [...outputs].filter(
    ([file, data]) =>
      !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== data,
  );
  if (check && (changed.length || obsolete.length))
    fail(
      `Generated icons stale: ${[...obsolete, ...changed.map(([file]) => file)].map((file) => path.basename(file)).join(', ')}`,
    );
  if (!check && (changed.length || obsolete.length)) {
    fs.mkdirSync(temporaryRoot, { recursive: true });
    const staging = fs.mkdtempSync(path.join(temporaryRoot, 'onekey-icons-'));
    try {
      for (const [index, [file, data]] of changed.entries()) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temporary = path.join(staging, String(index));
        fs.writeFileSync(temporary, data);
        fs.renameSync(temporary, file);
      }
      for (const file of obsolete) fs.rmSync(file, { force: true });
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }
  return changed.length + obsolete.length;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argument = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? path.resolve(process.argv[index + 1]) : fallback;
  };
  const appRoot = argument('--app-root', appRootDefault);
  const outputRoot = argument('--output-root', outputRootDefault);
  const { outputs, count, diagnostics } = await generateOutputs(
    appRoot,
    outputRoot,
  );
  const bundleRoot = argument('--ios-bundle', undefined);
  let selected = outputs;
  if (bundleRoot) {
    selected = new Map(
      [...outputs]
        .filter(([file]) =>
          file.startsWith(path.join(outputRoot, 'native/icons') + path.sep),
        )
        .map(([file, data]) => [
          path.join(bundleRoot, path.basename(file)),
          data,
        ]),
    );
  } else if (process.argv.includes('--native-only')) {
    selected = new Map(
      [...outputs].filter(([file]) =>
        file.startsWith(path.join(outputRoot, 'native') + path.sep),
      ),
    );
  }
  const changed = writeOutputs(
    selected,
    process.argv.includes('--check'),
    bundleRoot
      ? (process.env.TARGET_BUILD_DIR ?? path.dirname(bundleRoot))
      : path.dirname(outputRoot),
  );
  console.log(
    JSON.stringify({ count, outputs: selected.size, changed, diagnostics }),
  );
}
