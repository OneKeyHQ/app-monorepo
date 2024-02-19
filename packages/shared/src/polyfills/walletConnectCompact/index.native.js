import { getApplicationModule } from '@walletconnect/react-native-compat/module';

// global.Application used by @walletconnect/core
if (typeof global?.Application === 'undefined') {
  try {
    const module = getApplicationModule();
    if (typeof module.getConstants === 'function') {
      global.Application = {
        ...module.getConstants(),
        isAppInstalled: module.isAppInstalled,
      };
    } else {
      global.Application = module;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('react-native-compat: Application module is not available');
  }
}
