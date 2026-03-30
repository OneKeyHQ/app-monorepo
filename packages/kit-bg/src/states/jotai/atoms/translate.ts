import {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ITranslateSettingsPersistAtom = {
  engine: ETranslateEngine;
  displayMode: ETranslateDisplayMode;
  targetLanguage: string;
};

export const translateSettingsPersistAtomInitialValue: ITranslateSettingsPersistAtom =
  {
    engine: ETranslateEngine.ai,
    displayMode: ETranslateDisplayMode.bilingual,
    targetLanguage: 'auto',
  };

export const {
  target: translateSettingsPersistAtom,
  use: useTranslateSettingsPersistAtom,
} = globalAtom<ITranslateSettingsPersistAtom>({
  persist: true,
  name: EAtomNames.translateSettingsPersistAtom,
  initialValue: translateSettingsPersistAtomInitialValue,
});
