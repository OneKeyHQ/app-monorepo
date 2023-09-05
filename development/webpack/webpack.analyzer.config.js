const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const { ENABLE_ANALYZER_HTML_REPORT = false } = process.env;

module.exports = ({ configName }) => ({
  plugins: [
    new BundleAnalyzerPlugin(
      ENABLE_ANALYZER_HTML_REPORT
        ? {
            analyzerMode: 'static',
            reportFilename: `report${configName ? `-${configName}` : ''}.html`,
            openAnalyzer: false,
          }
        : {
            analyzerMode: 'disabled',
            generateStatsFile: true,
            statsOptions: {
              reasons: false,
              warnings: false,
              errors: false,
              optimizationBailout: false,
              usedExports: false,
              providedExports: false,
              source: false,
              ids: false,
              children: false,
              chunks: false,
              modules: !!process.env.ANALYSE_MODULE,
            },
          },
    ),
  ],
});
