
import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

interface IDevSetting {
  enabled: boolean;
  data: Record<string, unknown>;
}

export type IDevSettingsPersistAtom = {
  enabled?: boolean;
  settings?: IDevSetting[];
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
