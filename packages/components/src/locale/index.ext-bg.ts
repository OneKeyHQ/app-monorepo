import platformEnv from '@onekeyhq/shared/src/platformEnv';

const enUS = {
  'Confirm_password': 'Confirm Password',
};

const LOCALES = {
  'en-US': enUS,
};

const LOCALES_OPTION = Object.keys(LOCALES).map((key) => ({
  value: key,
  label: '',
}));

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/locale is not allowed imported from background');
}

export type ILocaleSymbol = keyof typeof LOCALES;
export type ILocaleIds = keyof typeof enUS;

export default LOCALES;
export { LOCALES_OPTION };
