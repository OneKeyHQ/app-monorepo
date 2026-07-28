import { reactNavigationIntegration } from '@sentry/react-native';

export const navigationIntegration = reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});
