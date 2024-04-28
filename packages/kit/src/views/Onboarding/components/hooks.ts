import { useCallback, useMemo, useRef, useState } from 'react';

import wordLists from 'bip39/src/wordlists/english.json';
import { shuffle } from 'lodash';
import { InteractionManager, Keyboard } from 'react-native';

import type { useForm } from '@onekeyhq/components';
import { Toast, useClipboard, useKeyboardEvent } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const isValidWord = (word: string) => wordLists.includes(word);

export const useSearchWords = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const ref = useRef(new Map<string, string[]>());
  const suggestionsRef = useRef<string[]>([]);

  const updateSuggestions = useCallback((suggestionWords: string[]) => {
    suggestionsRef.current = suggestionWords;
    setSuggestions(suggestionWords);
  }, []);

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
  };
};

export const useSuggestion = (
  form: ReturnType<typeof useForm>,
  phraseLength = 12,
) => {
  const { fetchSuggestions, suggestions, updateSuggestions, suggestionsRef } =
    useSearchWords();

  const [isShowErrors, setIsShowErrors] = useState<Record<string, boolean>>({});

  const [selectInputIndex, setSelectInputIndex] = useState(-1);

  // only work on web
  const openStatusRef = useRef(false);

  const updateByPressLock = useRef(false);

  const checkIsValidWord = useCallback(
    (index: number, text?: string, isBlur = false) => {
      setTimeout(() => {
        if (!text) {
          setIsShowErrors((prev) => ({ ...prev, [index]: false }));
          return;
        }

        if (platformEnv.isNative && isBlur) {
          if (isValidWord(text)) {
            setIsShowErrors((prev) => ({ ...prev, [index]: false }));
          } else {
            setIsShowErrors((prev) => ({ ...prev, [index]: true }));
          }
          return;
        }

        if (
          isBlur &&
          (!openStatusRef.current ||
            (suggestionsRef.current && suggestionsRef.current?.length === 0))
        ) {
          if (isValidWord(text)) {
            setIsShowErrors((prev) => ({ ...prev, [index]: false }));
          } else {
            setIsShowErrors((prev) => ({ ...prev, [index]: true }));
          }
          return;
        }

        if (
          selectInputIndex === index &&
          suggestionsRef.current &&
          suggestionsRef.current?.length > 0
        ) {
          setIsShowErrors((prev) => ({ ...prev, [index]: false }));
          return;
        }
        setIsShowErrors((prev) => ({ ...prev, [index]: false }));
      }, 0);
    },
    [selectInputIndex, suggestionsRef],
  );

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
      const text = value.toLowerCase().trim();
      const words = fetchSuggestions(text);
      openStatusRef.current = words.length > 0;
      checkIsValidWord(selectInputIndex, text);
      return text;
    },
    [checkIsValidWord, fetchSuggestions, resetSuggestions, selectInputIndex],
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

  const onInputFocus = useCallback((index: number) => {
    setSelectInputIndex(index);
  }, []);

  const onInputBlur = useCallback(
    async (index: number) => {
      if (platformEnv.isNative) {
        checkIsValidWord(selectInputIndex, getFormValueByIndex(index), true);
        return;
      }

      // check popover status
      if (openStatusRef.current && index === selectInputIndex) {
        return;
      }
      if (index === selectInputIndex) {
        setSelectInputIndex(-1);
      }
      openStatusRef.current = false;
      checkIsValidWord(selectInputIndex, getFormValueByIndex(index), true);
    },
    [checkIsValidWord, getFormValueByIndex, selectInputIndex],
  );

  const { copyText } = useClipboard();

  const onPasteMnemonic = useCallback(
    (value: string) => {
      const arrays = value.split(' ');
      if (arrays.length === phraseLength) {
        setTimeout(() => {
          copyText(' ');
          Toast.success({ title: 'Pasted and clipboard cleared' });
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
      return false;
    },
    [copyText, form, phraseLength, resetSuggestions],
  );

  const closePopover = useCallback(() => {
    resetSuggestions();
    checkIsValidWord(
      selectInputIndex,
      getFormValueByIndex(selectInputIndex),
      true,
    );
  }, [
    checkIsValidWord,
    getFormValueByIndex,
    resetSuggestions,
    selectInputIndex,
  ]);

  return useMemo(
    () => ({
      isShowErrors,
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
      closePopover,
    }),
    [
      isShowErrors,
      suggestions,
      onInputFocus,
      onInputBlur,
      onPasteMnemonic,
      suggestionsRef,
      updateInputValueWithLock,
      onInputChange,
      selectInputIndex,
      focusNextInput,
      closePopover,
    ],
  );
};
