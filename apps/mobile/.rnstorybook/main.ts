import type { StorybookConfig } from '@storybook/react-native';

const main: StorybookConfig = {
  // Same colocated CSF files the web playground (apps/playground) consumes —
  // one story set, two shells.
  stories: ['../../../packages/components/src/**/*.stories.@(ts|tsx)'],
  deviceAddons: [
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
  ],
};

export default main;
