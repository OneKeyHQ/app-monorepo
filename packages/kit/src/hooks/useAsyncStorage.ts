import { useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAsyncStorage = <T>(key: string, initialValue: T) => {
  const [data, setData] = useState(initialValue);
  const [, setRetrievedFromStorage] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem(key);
        setData(value ? (JSON.parse(value) as T) : initialValue);
        setRetrievedFromStorage(true);
      } catch (error) {
        console.error('useAsyncStorage getItem error:', error);
      }
    })();
  }, [key, initialValue]);

  const setNewData = (value: T) => {
    try {
      AsyncStorage.setItem(key, JSON.stringify(value));
      setData(value);
    } catch (error) {
      console.error('useAsyncStorage setItem error:', error);
    }
  };

  return [data, setNewData];
};
