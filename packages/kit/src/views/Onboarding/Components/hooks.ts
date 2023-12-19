import { useCallback, useRef, useState } from 'react';

import wordLists from 'bip39/src/wordlists/english.json';
import { shuffle } from 'lodash';
import { InteractionManager } from 'react-native';

import { type useForm, useKeyboardEvent } from '@onekeyhq/components';

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

export const useSuggestion = (form: ReturnType<typeof useForm>) => {
  const {
    fetchSuggestions,
    suggestions,
    updateSuggestions,
    isValidWord,
    suggestionsRef,
  } = useSearchWords();

  const [selectInputIndex, setSelectInputIndex] = useState(-1);

  const openStatusRef = useRef(false);

  const resetSuggestions = useCallback(() => {
    openStatusRef.current = false;
    updateSuggestions([]);
  }, [updateSuggestions]);

  const focusNextInput = useCallback(async () => {
    await InteractionManager.runAfterInteractions();
    const key = `phrase${selectInputIndex + 2}`;
    setTimeout(() => {
      form.setFocus(key);
    }, 300);
  }, [form, selectInputIndex]);

  const updateInputValue = useCallback(
    (word: string) => {
      const key = `phrase${selectInputIndex + 1}`;
      form.setValue(key, word);
    },
    [form, selectInputIndex],
  );

  const onInputChange = useCallback(
    (value: string) => {
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

  const getFormValue = useCallback(() => {
    const key = `phrase${selectInputIndex + 1}`;
    const values = form.getValues() as Record<string, string>;
    const value = values[key];
    return value;
  }, [form, selectInputIndex]);

  const updateInputValueWithLock = useCallback(
    (word: string) => {
      updateInputValue(word);
      resetSuggestions();
      if (word.length > 0) {
        void focusNextInput();
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

  const checkIsValid = useCallback(() => {
    const value = getFormValue();
    const result = isValidWord(value);
    if (!result) {
      updateInputValueWithLock('');
      openStatusRef.current = false;
    }
  }, [getFormValue, isValidWord, updateInputValueWithLock]);

  const onInputFocus = useCallback(
    (index: number) => {
      if (openStatusRef.current && index !== selectInputIndex) {
        checkIsValid();
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
        checkIsValid();
        setSelectInputIndex(-1);
      }
      openStatusRef.current = false;
    },
    [checkIsValid, selectInputIndex],
  );
  return {
    suggestions,
    onInputFocus,
    onInputBlur,
    suggestionsRef,
    updateInputValue: updateInputValueWithLock,
    openStatusRef,
    onInputChange,
    selectInputIndex,
    closePopover: resetSuggestions,
  };
};
