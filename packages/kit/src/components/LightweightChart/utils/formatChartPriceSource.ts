// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import formatChartPriceSource from './formatChartPrice.text-js';

export default String(formatChartPriceSource);
