/**
 * Script to generate SVG icons from React Native SVG components for native tab bar
 *
 * Usage:
 *   Run: node development/svg/generateTabIconPngs.js
 *
 * Output:
 *   - Creates SVG files in packages/kit/assets/tabbar/ directory
 *   - SVG files can be used directly with react-native-bottom-tabs
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

// Source directory for React SVG components
const reactDir = path.join(
  ROOT_DIR,
  'packages/components/src/primitives/Icon/react',
);
// Output directory for generated SVG files
const outputDir = path.join(ROOT_DIR, 'packages/kit/assets/tabbar/svg');

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
 * Note: Using currentColor allows the native tab bar to tint the icon
 */
function generateSvg(parsedData) {
  const { viewBox, paths } = parsedData;

  const pathElements = paths
    .map((p) => {
      // Keep currentColor so native tab bar can apply tint
      let attrs = `d="${p.d}"`;
      if (p.fill) attrs += ` fill="${p.fill}"`;
      if (p.fillRule) attrs += ` fill-rule="${p.fillRule}"`;
      if (p.clipRule) attrs += ` clip-rule="${p.clipRule}"`;
      return `  <path ${attrs}/>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">
${pathElements}
</svg>`;
}

/**
 * Main function
 */
async function main() {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
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

    // Generate SVG file
    const svgContent = generateSvg(parsedData);
    const svgPath = path.join(outputDir, `${icon.name}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`  Created: ${icon.name}.svg`);
  }

  console.log('\nDone!');
  console.log(`\nSVG files generated in: ${outputDir}`);
}

main().catch(console.error);
