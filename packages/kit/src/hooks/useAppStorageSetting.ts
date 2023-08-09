import { useEffect, useState } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

export const useAppStorageSetting = (key: string, initialValue?: boolean) => {
  const [data, setData] = useState(initialValue);

  useEffect(() => {
    const value = appStorage.getSettingBoolean(key);
    setData(!!value);
  }, [key, initialValue]);

  const setNewData = (value: boolean) => {
    appStorage.setSetting(key, value);
    setData(value);
  };

  return [data, setNewData];
};
