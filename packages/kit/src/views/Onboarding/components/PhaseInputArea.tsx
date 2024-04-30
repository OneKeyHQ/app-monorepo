import type { ComponentType, PropsWithChildren, RefObject } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { compact, range } from 'lodash';
import { Dimensions, View } from 'react-native';

import type {
  IButtonProps,
  IElement,
  IInputProps,
  IPageFooterProps,
  IPropsWithTestId,
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
  SecureView,
  Select,
  SizableText,
  Stack,
  XStack,
  useForm,
  useIsKeyboardShown,
  useMedia,
  usePage,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSuggestion } from './hooks';
import { Tutorials } from './Tutorials';

import type { ITutorialsListItemProps } from './Tutorials';
import type { ReturnKeyTypeOptions, TextInput, ViewProps } from 'react-native';

const KeyDownView = View as unknown as ComponentType<
  PropsWithChildren<
    {
      onKeyDown: (e: {
        keyCode: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      }) => void;
    } & ViewProps
  >
>;

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
    <Stack position="relative">
      <Button
        size="small"
        ref={buttonRef}
        onPress={handlePress}
        focusable
        tabIndex={tabIndex}
        {...rest}
      >
        {word}
      </Button>
      <Stack
        bg="$bg"
        position="absolute"
        right="$px"
        top="$0"
        height="$4"
        width="$4"
        justifyContent="center"
        alignItems="center"
        borderRadius="$full"
      >
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {number}
        </SizableText>
      </Stack>
    </Stack>
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
        testID={`suggest-${word}`}
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
}: {
  suggestions: string[];
  updateInputValue: (text: string) => void;
  onConfirm: IPageFooterProps['onConfirm'];
}) {
  const isShow = useIsKeyboardShown();
  return (
    <Page.Footer>
      <Page.FooterActions onConfirm={onConfirm} />
      {isShow ? (
        <SuggestionList
          suggestions={suggestions}
          onPressItem={updateInputValue}
        />
      ) : null}
    </Page.Footer>
  );
}

const { height: windowHeight } = Dimensions.get('window');
const visibleHeight = windowHeight / 5;

const PINYIN_COMPOSITION_SPACE = platformEnv.isNative
  ? String.fromCharCode(8198)
  : ' ';

function BasicPhaseInput(
  {
    index,
    onChange,
    value,
    onInputChange,
    onInputFocus,
    onInputBlur,
    onPasteMnemonic,
    suggestionsRef,
    updateInputValue,
    selectInputIndex,
    openStatusRef,
    closePopover,
    onReturnKeyPressed,
    getReturnKeyLabel,
    testID = '',
  }: IPropsWithTestId<{
    value?: string;
    index: number;
    onInputChange: (value: string) => string;
    onChange?: (value: string) => void;
    onInputFocus: (index: number) => void;
    onPasteMnemonic: (text: string) => boolean;
    onInputBlur: (index: number) => void;
    suggestionsRef: RefObject<string[]>;
    selectInputIndex: number;
    openStatusRef: RefObject<boolean>;
    updateInputValue: (text: string) => void;
    closePopover: () => void;
    onReturnKeyPressed: (index: number) => void;
    getReturnKeyLabel: (index: number) => ReturnKeyTypeOptions;
  }>,
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
          const contentOffset = getContentOffset();
          console.log(x, y, pageX, pageY, contentOffset);
          if (pageY > visibleHeight) {
            setTimeout(() => {
              pageRef.scrollTo({
                x: 0,
                y: contentOffset.y + pageY - visibleHeight,
                animated: true,
              });
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
      if (onPasteMnemonic(v)) {
        onInputChange('');
        onChange?.('');
        return;
      }
      const rawText = v.replaceAll(PINYIN_COMPOSITION_SPACE, '');
      const text = onInputChange(rawText);
      onChange?.(text);
    },
    [onChange, onInputChange, onPasteMnemonic],
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

  const handleSelectSuggestionByNumber = useCallback(
    (e: {
      keyCode: number;
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (suggestionsRef.current && e.keyCode > 48 && e.keyCode < 58) {
        const suggestionIndex = e.keyCode - 48;
        updateInputValue(suggestionsRef.current[suggestionIndex - 1]);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [suggestionsRef, updateInputValue],
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
      } else {
        handleSelectSuggestionByNumber(e);
      }
    },
    [handleSelectSuggestionByNumber, openStatusRef],
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
    autoComplete: 'off',
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
    // auto focus on the first input when entering the page.
    autoFocus: index === 0,
  };
  if (platformEnv.isNative) {
    return (
      <Input
        {...inputProps}
        secureTextEntry={platformEnv.isNativeAndroid}
        keyboardType={
          platformEnv.isNativeAndroid ? 'visible-password' : 'ascii-capable'
        }
        onSubmitEditing={handleSubmitEnding}
        testID={testID}
      />
    );
  }
  return (
    <Popover
      title="Select Word"
      placement="bottom-start"
      usingSheet={false}
      onOpenChange={handleOpenChange}
      open={
        openStatusRef.current
          ? selectInputIndex === index && suggestions.length > 0
          : false
      }
      floatingPanelProps={{
        $md: {
          px: '$4',
          width: '100vw',
          outlineWidth: 0,
          bg: '$transparent',
          borderWidth: 0,
        },
      }}
      renderContent={
        <Stack $md={{ bg: '$bg', borderRadius: '$3' }}>
          <KeyDownView onKeyDown={handleSelectSuggestionByNumber}>
            <SuggestionList
              firstButtonRef={firstButtonRef}
              suggestions={suggestions}
              onPressItem={updateInputValue}
              isFocusable={tabFocusable}
            />
          </KeyDownView>
        </Stack>
      }
      renderTrigger={
        <Stack>
          <Input
            {...inputProps}
            onKeyPress={handleKeyPress}
            data-1p-ignore
            testID={testID}
          />
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
  tutorials: ITutorialsListItemProps[];
  defaultPhrases?: string[];
}) {
  const [phraseLength, setPhraseLength] = useState(
    phraseLengthOptions[0].value,
  );
  const { serviceAccount, servicePassword } = backgroundApiProxy;
  const defaultPhrasesMap = useMemo(() => {
    const map: Record<string, string> = {};
    range(0, Number(phraseLength))?.forEach((_, i) => {
      map[`phrase${i + 1}`] = defaultPhrases[i] || '';
    });
    return map;
  }, [defaultPhrases, phraseLength]);
  const form = useForm({
    defaultValues: defaultPhrasesMap,
  });

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
    onPasteMnemonic,
  } = useSuggestion(form, Number(phraseLength));

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
    // form.reset(); // not working if all words filled
    Object.entries(defaultPhrasesMap).forEach(([key, value]) => {
      form.setValue(key, value);
    });
  }, [defaultPhrasesMap, form]);

  return (
    <>
      <Page.Body>
        {showPhraseLengthSelector || showClearAllButton ? (
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
                    testID="phrase-length"
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
                testID="clear-all"
              >
                Clear
              </Button>
            ) : null}
          </XStack>
        ) : null}

        <SecureView>
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
                      onPasteMnemonic={onPasteMnemonic}
                      suggestionsRef={suggestionsRef}
                      updateInputValue={updateInputValue}
                      openStatusRef={openStatusRef}
                      selectInputIndex={selectInputIndex}
                      closePopover={closePopover}
                      onReturnKeyPressed={handleReturnKeyPressed}
                      getReturnKeyLabel={getReturnKeyLabel}
                      testID={`phrase-input-index${index}`}
                    />
                  </Form.Field>
                </Stack>
              ))}
            </XStack>
          </Form>
        </SecureView>

        <HeightTransition>
          {invalidWordsLength > 0 ? (
            <XStack pt="$1.5" px="$5" key="invalidWord">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                {invalidWordsMessage(invalidWordsLength)}
              </SizableText>
            </XStack>
          ) : null}
          {invalidPhrase ? (
            <XStack pt="$1.5" px="$5" key="invalidPhrase">
              <Icon name="XCircleOutline" size="$5" color="$iconCritical" />
              <SizableText size="$bodyMd" color="$textCritical" pl="$2">
                Invalid recovery phrase
              </SizableText>
            </XStack>
          ) : null}
        </HeightTransition>
        <Tutorials px="$5" list={tutorials} />
      </Page.Body>
      <PageFooter
        suggestions={suggestions}
        updateInputValue={updateInputValue}
        onConfirm={handlePageFooterConfirm}
      />
    </>
  );
}
