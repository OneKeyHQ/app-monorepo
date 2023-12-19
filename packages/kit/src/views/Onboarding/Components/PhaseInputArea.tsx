import type { RefObject } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Dimensions, type TextInput } from 'react-native';

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
  useIsKeyboardShown,
  useMedia,
  usePage,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSuggestion } from './hooks';
import { Tutorials } from './Tutorials';

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
}: {
  suggestions: string[];
  updateInputValue: (text: string) => void;
  onConfirm: IPageFooterProps['onConfirm'];
}) {
  const isShow = useIsKeyboardShown();
  return (
    <Page.Footer extraData={[isShow, suggestions]}>
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
  },
  ref: any,
) {
  const inputRef: RefObject<TextInput> | null = useRef(null);
  const media = useMedia();
  const { getContentOffset, pageRef } = usePage();
  const firstButtonRef = useRef<IElement>(null);
  const [tabFocusable, setTabFFocusable] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

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
        setTabFFocusable(false);
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
          setTabFFocusable(true);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.keyCode > 48 && e.keyCode < 57) {
        const suggestionIndex = e.keyCode - 48;
        updateInputValue((suggestionsRef.current ?? [])[suggestionIndex - 1]);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [openStatusRef, suggestionsRef, updateInputValue],
  ) as unknown as IInputProps['onKeyPress'];

  const suggestions = suggestionsRef.current ?? [];

  if (platformEnv.isNative) {
    return (
      <Input
        value={value}
        ref={inputRef}
        secureTextEntry={selectInputIndex !== index}
        autoCorrect={false}
        spellCheck={false}
        size={media.md ? 'large' : 'medium'}
        leftAddOnProps={{
          label: `${index + 1}`,
          minWidth: '$10',
          justifyContent: 'center',
        }}
        onChangeText={handleChangeText}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        returnKeyType="next"
      />
    );
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
          <Input
            ref={inputRef}
            value={value}
            secureTextEntry={selectInputIndex !== index}
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            onKeyPress={handleKeyPress}
            size={media.md ? 'large' : 'medium'}
            leftAddOnProps={{
              label: `${index + 1}`,
              minWidth: '$10',
              justifyContent: 'center',
            }}
            onChangeText={handleChangeText}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            returnKeyType="next"
            data-1p-ignore
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
}: {
  onConfirm: (values: string[]) => void;
  showPhraseLengthSelector?: boolean;
  tutorials: { title: string; description: string }[];
}) {
  const form = useForm({});
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

  const handlePageFooterConfirm = useCallback(() => {
    onConfirm(Object.values(form.getValues() as string[]));
  }, [form, onConfirm]);

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
  } = useSuggestion(form);

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
          ) : (
            <Stack flex={1} />
          )}
          <Button
            icon="BroomOutline"
            size="small"
            variant="tertiary"
            onPress={handleClear}
          >
            Clear
          </Button>
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
                  />
                </Form.Field>
              </Stack>
            ))}
          </XStack>
        </Form>
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
      />
    </>
  );
}
