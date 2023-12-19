import type { MutableRefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import wordLists from 'bip39/src/wordlists/english.json';

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
        ref.current.set(value, suggestionWords);
        updateSuggestions(suggestionWords);
      }
      return suggestionsRef.current;
    },
    [updateSuggestions],
  );
  const resetSuggestions = useCallback(() => {
    updateSuggestions([]);
  }, [updateSuggestions]);
  return {
    fetchSuggestions,
    suggestionsRef,
    suggestions,
    updateSuggestions,
    resetSuggestions,
    isValidWord,
  };
};

export const useSuggestion = (
  form: ReturnType<typeof useForm>,
  selectInputIndex: MutableRefObject<number>,
) => {
  const {
    fetchSuggestions,
    suggestions,
    updateSuggestions,
    resetSuggestions,
    isValidWord,
    suggestionsRef,
  } = useSearchWords();

  const openStatusRef = useRef(false);

  const updateInputValue = useCallback(
    (word: string) => {
      const index = selectInputIndex.current;
      const key = `phrase${index + 1}`;
      form.setValue(key, word);
    },
    [form, selectInputIndex],
  );

  const onInputChange = useCallback(
    (value: string) => {
      if (!value) {
        resetSuggestions();
        openStatusRef.current = false;
      }
      const text = value.toLowerCase().trim();
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
    const index = selectInputIndex.current;
    const key = `phrase${index + 1}`;
    const values = form.getValues() as Record<string, string>;
    const value = values[key];
    return value;
  }, [form, selectInputIndex]);

  const updateInputValueWithLock = useCallback(
    (word: string) => {
      openStatusRef.current = false;
      updateInputValue(word);
      resetSuggestions();
    },
    [resetSuggestions, updateInputValue],
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
      if (openStatusRef.current && index !== selectInputIndex.current) {
        checkIsValid();
      }
      selectInputIndex.current = index;
    },
    [checkIsValid, selectInputIndex],
  );

  const onInputBlur = useCallback(
    async (index: number) => {
      if (openStatusRef.current && index === selectInputIndex.current) {
        return;
      }
      if (index === selectInputIndex.current) {
        checkIsValid();
        selectInputIndex.current = -1;
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
  };
};
