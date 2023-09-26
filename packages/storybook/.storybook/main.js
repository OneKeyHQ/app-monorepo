module.exports = {
  stories: [
    '../../components/**/*.stories.mdx',
    '../../components/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-links', '@storybook/addon-essentials'],
  viteFinal: async (config, { configType }) => {
    const { tamaguiPlugin } = require('@tamagui/vite-plugin');
    config.plugins.push(
      tamaguiPlugin({
        config: '../tamagui.config.ts',
        components: ['tamagui'],
      }),
    );

    return config;
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  typescript: {
    reactDocgen: 'react-docgen',
  },
  env: (config) => ({
    ...config,
    TAMAGUI_TARGET: 'web',
  }),
};
