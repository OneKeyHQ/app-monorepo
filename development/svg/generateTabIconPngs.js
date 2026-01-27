/**
 * Script to generate PNG icons from React Native SVG components for native tab bar
 *
 * Usage:
 *   1. Install sharp: npm install sharp (or yarn add sharp)
 *   2. Run: node development/svg/generateTabIconPngs.js
 *
 * Output:
 *   - Creates PNG files in packages/kit/assets/tabbar/ directory
 *   - Generates @1x, @2x, @3x versions for React Native
 */

const fs = require('fs');
const path = require('path');

// Root directory of the monorepo
const ROOT_DIR = path.resolve(__dirname, '../..');

// Tab icons configuration - maps icon name to source file
const TAB_ICONS = [
  // Home tab
  { name: 'WalletSolid', source: 'solid/Wallet.tsx' },
  { name: 'WalletOutline', source: 'outline/Wallet.tsx' },
  // Market tab
  { name: 'ChartTrendingUp2Solid', source: 'solid/ChartTrendingUp2.tsx' },
  { name: 'ChartTrendingUp2Outline', source: 'outline/ChartTrendingUp2.tsx' },
  // Swap tab
  { name: 'SwapHorSolid', source: 'solid/SwapHor.tsx' },
  { name: 'SwapHorOutline', source: 'outline/SwapHor.tsx' },
  // Perp tab
  { name: 'TradingViewCandlesSolid', source: 'solid/TradingViewCandles.tsx' },
  {
    name: 'TradingViewCandlesOutline',
    source: 'outline/TradingViewCandles.tsx',
  },
  // Earn tab
  { name: 'CoinsSolid', source: 'solid/Coins.tsx' },
  { name: 'CoinsOutline', source: 'outline/Coins.tsx' },
  // Discovery tab
  { name: 'CompassCircleSolid', source: 'solid/CompassCircle.tsx' },
  { name: 'CompassCircleOutline', source: 'outline/CompassCircle.tsx' },
  // Developer tab
  { name: 'CodeBracketsSolid', source: 'solid/CodeBrackets.tsx' },
  { name: 'CodeBracketsOutline', source: 'outline/CodeBrackets.tsx' },
  // Device Management tab
  { name: 'OnekeyDeviceCustom', source: 'custom/OnekeyDevice.tsx' },
  // Refer Friends tab
  { name: 'GiftOutline', source: 'outline/Gift.tsx' },
];

// Base sizes for PNG output (will generate @1x, @2x, @3x)
const BASE_SIZE = 24;
const SCALES = [1, 2, 3];

// Icon colors for light and dark modes
const ICON_COLORS = {
  light: {
    unfocused: '#8C8CA1', // Gray for inactive tabs in light mode
    focused: '#000000', // Black for active tabs in light mode
  },
  dark: {
    unfocused: '#8C8CA1', // Gray for inactive tabs in dark mode
    focused: '#FFFFFF', // White for active tabs in dark mode
  },
};

// Source directory for React SVG components
const reactDir = path.join(
  ROOT_DIR,
  'packages/components/src/primitives/Icon/react',
);
// Output directory for generated PNG files
const outputDir = path.join(ROOT_DIR, 'packages/kit/assets/tabbar');

/**
 * Parse React Native SVG component file and extract SVG content
 */
function parseReactSvgComponent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract viewBox
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  // Extract all Path elements
  const pathRegex = /<Path\s+([\s\S]*?)(?:\/>|>[\s\S]*?<\/Path>)/g;
  const paths = [];
  let match;

  while ((match = pathRegex.exec(content)) !== null) {
    const pathContent = match[1];

    // Extract d attribute (path data)
    const dMatch = pathContent.match(/d="([^"]+)"/);
    if (!dMatch) continue;

    const pathData = {
      d: dMatch[1],
    };

    // Extract fill attribute
    const fillMatch = pathContent.match(/fill="([^"]+)"/);
    if (fillMatch) {
      pathData.fill = fillMatch[1];
    }

    // Extract fillRule attribute
    const fillRuleMatch = pathContent.match(/fillRule="([^"]+)"/);
    if (fillRuleMatch) {
      pathData.fillRule = fillRuleMatch[1];
    }

    // Extract clipRule attribute
    const clipRuleMatch = pathContent.match(/clipRule="([^"]+)"/);
    if (clipRuleMatch) {
      pathData.clipRule = clipRuleMatch[1];
    }

    paths.push(pathData);
  }

  return { viewBox, paths };
}

/**
 * Generate SVG string from parsed data
 */
function generateSvg(parsedData, size, color) {
  const { viewBox, paths } = parsedData;

  const pathElements = paths
    .map((p) => {
      const fill = p.fill === 'currentColor' ? color : p.fill;
      let attrs = `d="${p.d}"`;
      if (fill) attrs += ` fill="${fill}"`;
      if (p.fillRule) attrs += ` fill-rule="${p.fillRule}"`;
      if (p.clipRule) attrs += ` clip-rule="${p.clipRule}"`;
      return `  <path ${attrs}/>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none">
${pathElements}
</svg>`;
}

/**
 * Try to require sharp from multiple locations
 */
function tryRequireSharp() {
  const possiblePaths = ['sharp', '/tmp/svg2png_temp/node_modules/sharp'];

  for (const p of possiblePaths) {
    try {
      return require(p);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Convert SVG to PNG using sharp
 */
async function svgToPng(svgString, outputPath, size, sharpModule) {
  await sharpModule(Buffer.from(svgString))
    .resize(size, size)
    .png()
    .toFile(outputPath);
  return true;
}

/**
 * Main function
 */
async function main() {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create subdirectories for different states and themes
  const dirs = {
    light: {
      unfocused: path.join(outputDir, 'light', 'unfocused'),
      focused: path.join(outputDir, 'light', 'focused'),
    },
    dark: {
      unfocused: path.join(outputDir, 'dark', 'unfocused'),
      focused: path.join(outputDir, 'dark', 'focused'),
    },
    svg: path.join(outputDir, 'svg'),
  };

  // Create all directories
  Object.values(dirs.light).forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  Object.values(dirs.dark).forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(dirs.svg)) fs.mkdirSync(dirs.svg, { recursive: true });

  const sharpModule = tryRequireSharp();
  const sharpAvailable = !!sharpModule;

  if (!sharpAvailable) {
    console.log(
      'Note: sharp module not available. Will only generate SVG files.',
    );
    console.log('To generate PNG files, run:');
    console.log(
      '  cd /tmp && mkdir -p svg2png_temp && cd svg2png_temp && npm init -y && npm install sharp',
    );
    console.log('Then run this script again.\n');
  }

  console.log('Processing tab icons...\n');
  console.log(`Source: ${reactDir}`);
  console.log(`Output: ${outputDir}\n`);

  for (const icon of TAB_ICONS) {
    const sourcePath = path.join(reactDir, icon.source);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: Source file not found: ${sourcePath}`);
      continue;
    }

    console.log(`Processing: ${icon.name}`);

    // Parse the React component
    const parsedData = parseReactSvgComponent(sourcePath);

    // Determine if this is a focused (Solid) or unfocused (Outline) icon
    const isFocused =
      icon.name.includes('Solid') || icon.name.includes('Custom');
    const focusState = isFocused ? 'focused' : 'unfocused';

    // Generate base icon name (remove Solid/Outline/Custom suffix)
    const baseName = icon.name
      .replace('Solid', '')
      .replace('Outline', '')
      .replace('Custom', '');

    // Generate SVG file (using light mode color as default)
    const svgContent = generateSvg(
      parsedData,
      BASE_SIZE,
      ICON_COLORS.light[focusState],
    );
    const svgPath = path.join(dirs.svg, `${icon.name}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`  Created SVG: svg/${icon.name}.svg`);

    // Generate PNG files for both light and dark modes
    if (sharpAvailable) {
      for (const theme of ['light', 'dark']) {
        const color = ICON_COLORS[theme][focusState];
        const targetDir = dirs[theme][focusState];

        for (const scale of SCALES) {
          const size = BASE_SIZE * scale;
          const suffix = scale === 1 ? '' : `@${scale}x`;
          const pngName = `${baseName}${suffix}.png`;
          const pngPath = path.join(targetDir, pngName);

          const scaledSvg = generateSvg(parsedData, size, color);
          await svgToPng(scaledSvg, pngPath, size, sharpModule);
          console.log(`  Created PNG: ${theme}/${focusState}/${pngName}`);
        }
      }
    }
  }

  console.log('\nDone!');

  if (sharpAvailable) {
    console.log(`\nPNG files generated in: ${outputDir}`);
    console.log(
      '- light/unfocused/: Outline icons for inactive tabs (light mode)',
    );
    console.log('- light/focused/: Solid icons for active tabs (light mode)');
    console.log(
      '- dark/unfocused/: Outline icons for inactive tabs (dark mode)',
    );
    console.log('- dark/focused/: Solid icons for active tabs (dark mode)');
  }

  console.log(`\nSVG files generated in: ${dirs.svg}`);

  // Generate usage example
  const usageExample = `
// Example usage in Tab/router.ts:
//
// Import the icons for both themes
// const tabIconWalletLight = require('@onekeyhq/kit/assets/tabbar/light/unfocused/Wallet.png');
// const tabIconWalletFocusedLight = require('@onekeyhq/kit/assets/tabbar/light/focused/Wallet.png');
// const tabIconWalletDark = require('@onekeyhq/kit/assets/tabbar/dark/unfocused/Wallet.png');
// const tabIconWalletFocusedDark = require('@onekeyhq/kit/assets/tabbar/dark/focused/Wallet.png');
//
// Then in nativeTabBarIcon (with theme detection):
// nativeTabBarIcon: ({ focused }) => {
//   const isDark = useTheme(); // or however you detect dark mode
//   if (isDark) {
//     return focused ? tabIconWalletFocusedDark : tabIconWalletDark;
//   }
//   return focused ? tabIconWalletFocusedLight : tabIconWalletLight;
// },
`;

  console.log(usageExample);
}

main().catch(console.error);
