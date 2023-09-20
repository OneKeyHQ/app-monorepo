import { useCallback, useState } from 'react';

import * as bip39 from 'bip39';
import { debounce } from 'lodash';

export const useAccessory = () => {
  const [valueText, setValueText] = useState('');
  const [accessoryData, setAccessoryData] = useState<string[] | undefined>([]);

  const onChangeText = debounce(
    useCallback((text: string) => {
      setValueText(text);
      if (text?.length > 1) {
        const splitArr = text.split(' ');
        const lastWord = splitArr.pop();
        if (lastWord && lastWord.length > 1) {
          const wordLists = bip39.wordlists.english;
          const result = wordLists.filter((word) => word.startsWith(lastWord));
          if (!result?.length) {
            setAccessoryData(undefined);
          } else {
            setAccessoryData(result);
          }
        } else {
          setAccessoryData([]);
        }
      } else {
        setAccessoryData([]);
      }
    }, []),
    150,
    { trailing: true, leading: false },
  );
  const onSelectedKeybordAcessory = useCallback(
    (value: string) => {
      const splitArr = valueText.split(' ');
      splitArr.pop();
      const newTextValue = `${[...splitArr, value].join(' ')} `;
      setValueText(newTextValue);
      setAccessoryData([]);
    },
    [valueText],
  );

  return {
    onChangeText,
    onSelectedKeybordAcessory,
    valueText,
    accessoryData,
    setAccessoryData,
  };
};

export const validMenmonicWord = (word: string) => {
  const wordLists = bip39.wordlists.english;
  return wordLists.find((value) => value === word);
};
