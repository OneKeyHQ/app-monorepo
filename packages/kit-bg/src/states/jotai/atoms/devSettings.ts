import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IDevSettings {
  // enable test endpoint
  enableTestEndpoint?: boolean;
  // show copy/paste button in onboarding page
  enableCopyPasteInOnboardingPage?: boolean;
}

export type IDevSettingsKeys = keyof IDevSettings;

export type IDevSettingsPersistAtom = {
  enabled: boolean;
  settings?: IDevSettings;
};
export const {
  target: devSettingsPersistAtom,
  use: useDevSettingsPersistAtom,
} = globalAtom<IDevSettingsPersistAtom>({
  persist: true,
  name: EAtomNames.devSettingsPersistAtom,
  initialValue: {
    enabled: false,
  },
});
