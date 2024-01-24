import type { RefObject } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as Clipboard from 'expo-clipboard';
import { compact } from 'lodash';
import { Dimensions } from 'react-native';

import type {
  IButtonProps,
  IElement,
  IInputProps,
  IPageFooterProps,
} from '@onekeyhq/components';
import {
  Button,
  Form,
  HeightTransition,
  Icon,
  Input,
  Page,
  Popover,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  useForm,
  useFormState,
  useIsKeyboardShown,
  useMedia,
  usePage,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSuggestion } from './hooks';
import { Tutorials } from './Tutorials';

import type { Control } from 'react-hook-form';
import type { ReturnKeyTypeOptions, TextInput } from 'react-native';

const phraseLengthOptions = [
  { label: '12 words', value: '12' },
  { label: '15 words', value: '15' },
  { label: '18 words', value: '18' },
  { label: '21 words', value: '21' },
  { label: '24 words', value: '24' },
];

interface IWordItemProps {
  word: string;
  onPress: (word: string) => void;
  buttonRef: any;
  number: number;
}

function WordItem({
  word,
  onPress,
  tabIndex = -1,
  buttonRef,
  number,
  ...rest
}: IWordItemProps & Omit<IButtonProps, 'onPress' | 'children'>) {
  const handlePress = useCallback(() => {
    onPress(word);
  }, [onPress, word]);
  return (
    <Button
      size="small"
      ref={buttonRef}
      onPress={handlePress}
      focusable
      tabIndex={tabIndex}
      {...rest}
    >
      {word}
      {!platformEnv.isNative && (
        <SizableText
          position="absolute"
          size="$bodySmMedium"
          right="$-2"
          top="$-1.5"
          bg="$bg"
          color="$textSubdued"
          px="$1"
          borderRadius="$full"
        >
          {number}
        </SizableText>
      )}
    </Button>
  );
}

function SuggestionList({
  suggestions,
  onPressItem,
  firstButtonRef,
  isFocusable = false,
}: {
  suggestions: string[];
  onPressItem: (text: string) => void;
  isFocusable?: boolean;
  firstButtonRef?: RefObject<IElement>;
}) {
  const wordItems = suggestions
    .slice(0, 9)
    .map((word, index) => (
      <WordItem
        number={index + 1}
        buttonRef={index === 0 ? firstButtonRef : undefined}
        tabIndex={isFocusable ? 0 : -1}
        key={word}
        word={word}
        onPress={onPressItem}
        m="$1.5"
      />
    ));

  if (platformEnv.isNative) {
    return (
      <ScrollView
        horizontal
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          p: '$1.5',
        }}
        showsHorizontalScrollIndicator={false}
      >
        {wordItems}
      </ScrollView>
    );
  }

  return (
    <XStack flexWrap="wrap" p="$1.5">
      {wordItems}
    </XStack>
  );
}

function PageFooter({
  suggestions,
  updateInputValue,
  onConfirm,
  control,
}: {
  suggestions: string[];
  updateInputValue: (text: string) => void;
  onConfirm: IPageFooterProps['onConfirm'];
  control: Control;
}) {
  const state = useFormState({ control });
  console.log('state.dirtyFields', state.dirtyFields);
  const isShow = useIsKeyboardShown();
  return (
    <Page.Footer>
      {isShow ? (
        <SuggestionList
          suggestions={suggestions}
          onPressItem={updateInputValue}
        />
      ) : null}
      <Page.FooterActions onConfirm={onConfirm} />
    </Page.Footer>
  );
}

const { height: windowHeight } = Dimensions.get('window');
const visibleHeight = windowHeight / 3;

function BasicPhaseInput(
  {
    index,
    onChange,
    value,
    onInputChange,
    onInputFocus,
    onInputBlur,
    suggestionsRef,
    updateInputValue,
    selectInputIndex,
    openStatusRef,
    closePopover,
    onReturnKeyPressed,
    getReturnKeyLabel,
  }: {
    value?: string;
    index: number;
    onInputChange: (value: string) => string;
    onChange?: (value: string) => void;
    onInputFocus: (index: number) => void;
    onInputBlur: (index: number) => void;
    suggestionsRef: RefObject<string[]>;
    selectInputIndex: number;
    openStatusRef: RefObject<boolean>;
    updateInputValue: (text: string) => void;
    closePopover: () => void;
    onReturnKeyPressed: (index: number) => void;
    getReturnKeyLabel: (index: number) => ReturnKeyTypeOptions;
  },
  ref: any,
) {
  const inputRef: RefObject<TextInput> | null = useRef(null);
  const media = useMedia();
  const { getContentOffset, pageRef } = usePage();
  const firstButtonRef = useRef<IElement>(null);
  const [tabFocusable, setTabFocusable] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  const handleGetReturnKeyLabel = useCallback(
    () => getReturnKeyLabel(index),
    [getReturnKeyLabel, index],
  );

  const handleInputFocus = useCallback(() => {
    onInputFocus(index);
    if (platformEnv.isNative && pageRef) {
      inputRef.current?.measure(
        (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => {
          console.log(x, y, pageX, pageY, getContentOffset());
          if (pageY > visibleHeight) {
            pageRef.scrollTo({
              x: 0,
              y: getContentOffset().y + pageY - visibleHeight,
              animated: true,
            });
          }
        },
      );
    }
  }, [getContentOffset, index, onInputFocus, pageRef]);
  const handleInputBlur = useCallback(() => {
    onInputBlur(index);
  }, [index, onInputBlur]);

  const handleChangeText = useCallback(
    (v: string) => {
      const text = onInputChange(v);
      onChange?.(text);
    },
    [onChange, onInputChange],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        closePopover();
        setTabFocusable(false);
      }
    },
    [closePopover],
  );

  const handleKeyPress = useCallback(
    (e: {
      keyCode: number;
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (e.keyCode === 9) {
        if (openStatusRef.current) {
          firstButtonRef.current?.focus();
          setTabFocusable(true);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.keyCode > 48 && e.keyCode < 58) {
        const suggestionIndex = e.keyCode - 48;
        updateInputValue((suggestionsRef.current ?? [])[suggestionIndex - 1]);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [openStatusRef, suggestionsRef, updateInputValue],
  ) as unknown as IInputProps['onKeyPress'];

  const handleSubmitEnding = useCallback(() => {
    onReturnKeyPressed(index);
  }, [index, onReturnKeyPressed]);

  const isShowValue = selectInputIndex !== index && value?.length;
  const displayValue = isShowValue ? '••••' : value;
  const suggestions = suggestionsRef.current ?? [];

  const keyLabel = handleGetReturnKeyLabel();
  const inputProps: IInputProps & { ref: RefObject<TextInput> } = {
    value: displayValue,
    ref: inputRef,
    keyboardType: 'ascii-capable',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
    size: media.md ? 'large' : 'medium',
    leftAddOnProps: {
      label: `${index + 1}`,
      minWidth: '$10',
      justifyContent: 'center',
    },
    onChangeText: handleChangeText,
    onFocus: handleInputFocus,
    onBlur: handleInputBlur,
    returnKeyLabel: keyLabel.toUpperCase(),
    returnKeyType: keyLabel,
  };
  if (platformEnv.isNative) {
    return <Input {...inputProps} onSubmitEditing={handleSubmitEnding} />;
  }
  return (
    <Popover
      title="Select Word"
      placement="bottom-start"
      usingSheet={false}
      onOpenChange={handleOpenChange}
      open={!!openStatusRef.current && selectInputIndex === index}
      renderContent={
        <SuggestionList
          firstButtonRef={firstButtonRef}
          suggestions={suggestions}
          onPressItem={updateInputValue}
          isFocusable={tabFocusable}
        />
      }
      renderTrigger={
        <Stack>
          <Input {...inputProps} onKeyPress={handleKeyPress} data-1p-ignore />
        </Stack>
      }
    />
  );
}

const PhaseInput = forwardRef(BasicPhaseInput);

export function PhaseInputArea({
  onConfirm,
  tutorials,
  showPhraseLengthSelector = true,
  showClearAllButton = true,
  defaultPhrases = [],
}: {
  onConfirm: (mnemonic: string) => void;
  showPhraseLengthSelector?: boolean;
  showClearAllButton?: boolean;
  tutorials: { title: string; description: string }[];
  defaultPhrases?: string[];
}) {
  const { serviceAccount, servicePassword } = backgroundApiProxy;
  const defaultPhrasesMap = useMemo(() => {
    const map: Record<string, string> = {};
    defaultPhrases?.forEach((text, i) => {
      map[`phrase${i + 1}`] = text;
    });
    return map;
  }, [defaultPhrases]);
  const form = useForm({
    defaultValues: defaultPhrasesMap,
  });
  const { control } = form;
  const [phraseLength, setPhraseLength] = useState(
    phraseLengthOptions[0].value,
  );

  const invalidWordsLength = 0;
  const invalidPhrase = false;
  const invalidWordsMessage = (length: number) => {
    if (length === 1) {
      return '1 invalid word';
    }
    return `${length} invalid words`;
  };

  const handlePageFooterConfirm = useCallback(async () => {
    const mnemonic: string = Object.values(form.getValues()).join(' ');
    const mnemonicEncoded = await servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    await serviceAccount.validateMnemonic(mnemonicEncoded);
    onConfirm(mnemonicEncoded);
  }, [form, onConfirm, serviceAccount, servicePassword]);

  // useScrollToInputArea(alertRef);

  const {
    suggestions,
    updateInputValue,
    onInputFocus,
    onInputBlur,
    onInputChange,
    suggestionsRef,
    openStatusRef,
    selectInputIndex,
    closePopover,
    focusNextInput,
  } = useSuggestion(form);

  const handleReturnKeyPressed = useCallback(
    (index: number) => {
      if (index === Number(phraseLength) - 1) {
        void handlePageFooterConfirm();
      } else {
        void focusNextInput();
      }
    },
    [focusNextInput, handlePageFooterConfirm, phraseLength],
  );

  const getReturnKeyLabel: (index: number) => ReturnKeyTypeOptions =
    useCallback(
      (index: number) =>
        index === Number(phraseLength) - 1 ||
        compact(Object.values(form.getValues())).length === Number(phraseLength)
          ? 'done'
          : 'next',
      [form, phraseLength],
    );

  const handleClear = useCallback(() => {
    form.reset();
  }, [form]);

  return (
    <>
      <Page.Body>
        <XStack px="$5" pb="$2" pt="$2" justifyContent="space-between">
          {showPhraseLengthSelector ? (
            <Select
              title="Select a length"
              placement="bottom-start"
              items={phraseLengthOptions}
              value={phraseLength}
              onChange={setPhraseLength}
              renderTrigger={({ value }) => (
                <Button
                  iconAfter="ChevronDownSmallOutline"
                  size="small"
                  variant="tertiary"
                >
                  {value} words
                </Button>
              )}
            />
          ) : null}
          {showClearAllButton ? (
            <Button
              icon="BroomOutline"
              size="small"
              variant="tertiary"
              onPress={handleClear}
            >
              Clear
            </Button>
          ) : null}
        </XStack>

        <Form form={form}>
          <XStack px="$4" flexWrap="wrap">
            {Array.from({ length: Number(phraseLength) }).map((_, index) => (
              <Stack
                key={index}
                $md={{
                  flexBasis: '50%',
                }}
                flexBasis="33.33%"
                p="$1"
              >
                <Form.Field name={`phrase${index + 1}`}>
                  <PhaseInput
                    index={index}
                    onInputBlur={onInputBlur}
                    onInputChange={onInputChange}
                    onInputFocus={onInputFocus}
                    suggestionsRef={suggestionsRef}
                    updateInputValue={updateInputValue}
                    openStatusRef={openStatusRef}
                    selectInputIndex={selectInputIndex}
                    closePopover={closePopover}
                    onReturnKeyPressed={handleReturnKeyPressed}
                    getReturnKeyLabel={getReturnKeyLabel}
                  />
                </Form.Field>
              </Stack>
            ))}
          </XStack>
        </Form>

        {platformEnv.isDev ? (
          <XStack px="$5" py="$2">
            <Button
              size="small"
              variant="tertiary"
              onPress={async () => {
                const mnemonic = await Clipboard.getStringAsync();
                try {
                  const phrasesArr: string[] = (mnemonic || '').split(' ');
                  form.reset(
                    phrasesArr.reduce((prev, next, index) => {
                      prev[`phrase${index + 1}`] = next;
                      return prev;
                    }, {} as Record<`phrase${number}`, string>),
                  );
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              Paste All(Only in Dev)
            </Button>
          </XStack>
        ) : null}

        <HeightTransition>
          {invalidWordsLength > 0 && (
            <XStack pt="$1.5" px="$5" key="invalidWord">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                {invalidWordsMessage(invalidWordsLength)}
              </SizableText>
            </XStack>
          )}
          {invalidPhrase && (
            <XStack pt="$1.5" px="$5" key="invalidPhrase">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                Invalid recovery phrase
              </SizableText>
            </XStack>
          )}
        </HeightTransition>
        <Tutorials px="$5" list={tutorials} />
      </Page.Body>
      <PageFooter
        suggestions={suggestions}
        updateInputValue={updateInputValue}
        onConfirm={handlePageFooterConfirm}
        control={control}
      />
    </>
  );
}
