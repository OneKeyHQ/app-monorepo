import { useCallback, useMemo, useRef, useState } from 'react';

import wordLists from 'bip39/src/wordlists/english.json';
import { shuffle } from 'lodash';
import { InteractionManager, Keyboard } from 'react-native';

import { Toast, type useForm, useKeyboardEvent } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useSearchWords = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const ref = useRef(new Map<string, string[]>());
  const suggestionsRef = useRef<string[]>([]);

  const updateSuggestions = useCallback((suggestionWords: string[]) => {
    suggestionsRef.current = suggestionWords;
    setSuggestions(suggestionWords);
  }, []);

  const isValidWord = useCallback(
    (word: string) => wordLists.includes(word),
    [],
  );

  const fetchSuggestions = useCallback(
    (value: string) => {
      if (!value) {
        return [];
      }
      const cachedSuggestions = ref.current.get(value);
      if (cachedSuggestions) {
        updateSuggestions(cachedSuggestions);
      } else {
        const suggestionWords = wordLists.filter((text: string) =>
          text.startsWith(value),
        );
        ref.current.set(value, shuffle(suggestionWords));
        updateSuggestions(suggestionWords);
      }
      return suggestionsRef.current;
    },
    [updateSuggestions],
  );
  return {
    fetchSuggestions,
    suggestionsRef,
    suggestions,
    updateSuggestions,
    isValidWord,
  };
};

export const useSuggestion = (
  form: ReturnType<typeof useForm>,
  phraseLength = 12,
) => {
  const {
    fetchSuggestions,
    suggestions,
    updateSuggestions,
    isValidWord,
    suggestionsRef,
  } = useSearchWords();

  const [selectInputIndex, setSelectInputIndex] = useState(-1);

  const openStatusRef = useRef(false);

  const updateByPressLock = useRef(false);

  const resetSuggestions = useCallback(() => {
    openStatusRef.current = false;
    updateSuggestions([]);
  }, [updateSuggestions]);

  const focusNextInput = useCallback(async () => {
    await InteractionManager.runAfterInteractions();
    const key = `phrase${selectInputIndex + 2}`;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (platformEnv.isNative && selectInputIndex === phraseLength - 1) {
          Keyboard.dismiss();
        } else {
          form.setFocus(key);
        }
        resolve();
      }, 300);
    });
  }, [form, phraseLength, selectInputIndex]);

  const updateInputValue = useCallback(
    (word: string) => {
      const key = `phrase${selectInputIndex + 1}`;
      form.setValue(key, word);
    },
    [form, selectInputIndex],
  );

  const onInputChange = useCallback(
    (value: string) => {
      // on ios, when the value is changed, onInputChange will called twice.
      //  so lock the update when the value is changed by press suggestion item.
      if (updateByPressLock.current) {
        return value;
      }
      if (!value) {
        resetSuggestions();
      }
      const text = value.toLowerCase().trim().slice(0, 4);
      const words = fetchSuggestions(text);
      openStatusRef.current = words.length > 0;
      if (words.length === 1 && text === words[0]) {
        return text.slice(0, value.length - 1);
      }
      return text;
    },
    [fetchSuggestions, resetSuggestions],
  );

  const getFormValueByIndex = useCallback(
    (index: number) => {
      const key = `phrase${index + 1}`;
      const values = form.getValues() as Record<string, string>;
      const value = values[key];
      return value;
    },
    [form],
  );

  const updateInputValueWithLock = useCallback(
    async (word: string) => {
      updateByPressLock.current = true;
      updateInputValue(word);
      resetSuggestions();
      // the value of invalid word is undefined
      if (word && word.length > 0) {
        await focusNextInput();
        setTimeout(
          () => {
            updateByPressLock.current = false;
          },
          platformEnv.isNative ? 300 : 0,
        );
      } else {
        updateByPressLock.current = false;
      }
    },
    [focusNextInput, resetSuggestions, updateInputValue],
  );

  useKeyboardEvent({
    keyboardWillHide: () => {
      setTimeout(() => {
        updateSuggestions([]);
      });
    },
  });

  const checkIsValid = useCallback(
    (index: number) => {
      setTimeout(async () => {
        const value = getFormValueByIndex(index);
        const result = isValidWord(value);
        if (!result) {
          await updateInputValueWithLock('');
          openStatusRef.current = false;
        }
      });
    },
    [getFormValueByIndex, isValidWord, updateInputValueWithLock],
  );

  const onInputFocus = useCallback(
    (index: number) => {
      if (openStatusRef.current && index !== selectInputIndex) {
        checkIsValid(index - 1);
      }
      setSelectInputIndex(index);
    },
    [checkIsValid, selectInputIndex],
  );

  const onInputBlur = useCallback(
    async (index: number) => {
      if (openStatusRef.current && index === selectInputIndex) {
        return;
      }
      if (index === selectInputIndex) {
        checkIsValid(index);
        setSelectInputIndex(-1);
      }
      openStatusRef.current = false;
    },
    [checkIsValid, selectInputIndex],
  );

  const clearForm = useCallback(() => {
    form.reset(
      new Array(phraseLength).reduce(
        (prev: Record<`phrase${number}`, string>, next, index) => {
          prev[`phrase${index + 1}`] = '';
          return prev;
        },
        {} as Record<`phrase${number}`, string>,
      ),
    );
    resetSuggestions();
  }, [form, phraseLength, resetSuggestions]);

  const onPasteMnemonic = useCallback(
    (value: string) => {
      if (value.length > 4) {
        const arrays = value.split(' ');
        if (arrays.length === phraseLength) {
          setTimeout(() => {
            form.reset(
              arrays.reduce((prev, next, index) => {
                prev[`phrase${index + 1}`] = next;
                return prev;
              }, {} as Record<`phrase${number}`, string>),
            );
            resetSuggestions();
          }, 10);
          return true;
        }
        Toast.message({ title: 'Max 4 chars' });
        return false;
      }
      return false;
    },
    [form, phraseLength, resetSuggestions],
  );

  return useMemo(
    () => ({
      suggestions,
      onInputFocus,
      onInputBlur,
      onPasteMnemonic,
      suggestionsRef,
      updateInputValue: updateInputValueWithLock,
      openStatusRef,
      onInputChange,
      selectInputIndex,
      focusNextInput,
      closePopover: resetSuggestions,
      clearForm,
    }),
    [
      clearForm,
      focusNextInput,
      onInputBlur,
      onInputChange,
      onInputFocus,
      onPasteMnemonic,
      resetSuggestions,
      selectInputIndex,
      suggestions,
      suggestionsRef,
      updateInputValueWithLock,
    ],
  );
};
