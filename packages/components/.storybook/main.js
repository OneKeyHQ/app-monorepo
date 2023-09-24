module.exports = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-react-native-web'],
  core: {
    builder: 'webpack5',
  },
  framework: '@storybook/react',
};
