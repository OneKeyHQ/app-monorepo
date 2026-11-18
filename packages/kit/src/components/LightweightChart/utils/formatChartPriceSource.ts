// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import formatChartPriceSource from './formatChartPrice.text-js';

// Re-export the embedded source. Native charts bake this string into the
// WebView document, so this module has to be rebuilt whenever text-js changes.
export default String(formatChartPriceSource);
