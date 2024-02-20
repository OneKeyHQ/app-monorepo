import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { InteractionManager } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';

import { Popover, Trigger } from '../../actions';
import { ListView, SectionList } from '../../layouts';
import { Heading, Icon, SizableText, Stack, XStack } from '../../primitives';
import { Input } from '../Input';

import { SelectContext } from './context';

import type { IContextType } from './context';
import type {
  ISelectItem,
  ISelectItemProps,
  ISelectProps,
  ISelectRenderTriggerProps,
  ISelectSection,
  ISelectTriggerProps,
} from './type';
import type { IListViewProps, ISectionListProps } from '../../layouts';

const useTriggerLabel = (value: string) => {
  const { selectedItemRef, sections, items } = useContext(SelectContext);
  if (!value || selectedItemRef.current.value !== value) {
    return '';
  }
  if (selectedItemRef.current.label) {
    return selectedItemRef.current.label;
  }

  if (sections) {
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      for (let j = 0; j < section.data.length; j += 1) {
        const item = section.data[j];
        if (item.value === value) {
          selectedItemRef.current.label = item.label;
          return item.label;
        }
      }
    }
  }

  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.value === value) {
        selectedItemRef.current.label = item.label;
        return item.label;
      }
    }
  }

  return '';
};

function SelectTrigger({ renderTrigger }: ISelectTriggerProps) {
  const { changeOpenStatus, value, placeholder, disabled, labelInValue } =
    useContext(SelectContext);
  const handleTriggerPressed = useCallback(() => {
    changeOpenStatus?.(true);
  }, [changeOpenStatus]);
  const renderValue = labelInValue
    ? (value as ISelectItem)?.value
    : (value as string);
  const label = useTriggerLabel(renderValue);
  return (
    <Trigger onPress={handleTriggerPressed} disabled={disabled}>
      {renderTrigger({
        value: renderValue,
        label,
        placeholder,
        disabled,
      })}
    </Trigger>
  );
}

function SelectItem({
  onSelect,
  value,
  label,
  leading,
  selectedValue,
  description,
  testID = '',
}: ISelectItemProps) {
  const { md } = useMedia();
  const handleSelect = useCallback(() => {
    onSelect({
      value,
      label,
    });
  }, [label, onSelect, value]);
  return useMemo(
    () => (
      <XStack
        key={value}
        px="$2"
        py="$1.5"
        borderRadius="$2"
        $md={{
          py: '$2.5',
          borderRadius: '$3',
        }}
        style={{
          borderCurve: 'continuous',
        }}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handleSelect}
        testID={testID}
      >
        {leading ? (
          <Stack alignContent="center" justifyContent="center" pr="$4">
            {leading}
          </Stack>
        ) : null}
        <Stack flex={1} userSelect="none">
          <SizableText
            $gtMd={{
              size: '$bodyMd',
            }}
          >
            {label}
          </SizableText>
          {description && (
            <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
              {description}
            </SizableText>
          )}
        </Stack>
        {selectedValue === value ? (
          <Icon
            flexShrink={0}
            ml="$2"
            name="CheckLargeOutline"
            size="$4"
            color="$iconActive"
            {...(md && {
              name: 'CheckRadioSolid',
              size: '$6',
              mr: '$0.5',
            })}
          />
        ) : null}
      </XStack>
    ),
    [
      description,
      handleSelect,
      label,
      leading,
      md,
      selectedValue,
      testID,
      value,
    ],
  );
}

const useRenderPopoverTrigger = () => {
  const { md } = useMedia();
  return md ? null : (
    <Stack
      width="100%"
      height="100%"
      position="absolute"
      left={0}
      top={0}
      pointerEvents="none"
    />
  );
};

function SelectContent() {
  const {
    changeOpenStatus,
    value,
    isOpen,
    title,
    items,
    onValueChange,
    sections,
    sheetProps,
    floatingPanelProps,
    placement,
    labelInValue,
    selectedItemRef,
  } = useContext(SelectContext);
  const handleSelect = useCallback(
    (item: ISelectItem) => {
      changeOpenStatus?.(false);
      void InteractionManager.runAfterInteractions(() => {
        selectedItemRef.current = item;
        onValueChange?.(labelInValue ? item : item.value);
      });
    },
    [changeOpenStatus, labelInValue, onValueChange, selectedItemRef],
  );

  const handleOpenChange = useCallback(
    (openStatus: boolean) => {
      changeOpenStatus?.(openStatus);
    },
    [changeOpenStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: ISelectItem }) => (
      <SelectItem
        {...item}
        onSelect={handleSelect}
        selectedValue={(value as ISelectItem)?.value || (value as string)}
        testID={`select-item-${item.value}`}
      />
    ),
    [handleSelect, value],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ISelectSection }) => (
      <Heading
        size="$headingXs"
        $md={{ size: '$headingSm', py: '$2.5' }}
        py="$1.5"
        px="$2"
        color="$textSubdued"
      >
        {section.title}
      </Heading>
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: ISelectItem, index: number) =>
      `${item.value}-${item.label}-${index}`,
    [],
  );

  console.log('data___', sections, items);
  const renderContent = useMemo(
    () => {
      const listProps = {
        contentContainerStyle: { flex: 1 },
        keyExtractor,
        estimatedItemSize: '$6',
        extraData: value,
        renderItem,
        p: '$1',
        $md: {
          p: '$3',
          // fix warning of `FlashList's rendered size is not usable`.
          // minHeight is 2 * $3 + $1(2px)
          minHeight: '$7',
        },
      };
      return sections ? (
        <SectionList
          sections={sections}
          renderSectionHeader={renderSectionHeader}
          {...(listProps as Omit<
            ISectionListProps<any>,
            'sections' | 'renderSectionHeader'
          >)}
        />
      ) : (
        <ListView
          data={items}
          {...(listProps as Omit<IListViewProps<ISelectItem>, 'data'>)}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen],
  );

  const popoverTrigger = useRenderPopoverTrigger();
  return (
    <Popover
      title={title || ''}
      open={isOpen}
      onOpenChange={handleOpenChange}
      keepChildrenMounted
      sheetProps={{
        dismissOnSnapToBottom: false,
        snapPointsMode: 'fit',
        ...sheetProps,
      }}
      floatingPanelProps={{
        maxHeight: '60vh',
        width: '$56',
        ...floatingPanelProps,
      }}
      placement={placement}
      renderTrigger={popoverTrigger}
      renderContent={renderContent}
    />
  );
}

function SelectFrame<T extends string | ISelectItem>({
  items,
  placeholder,
  value,
  onChange,
  children,
  title,
  disabled,
  sections,
  sheetProps,
  labelInValue = false,
  floatingPanelProps,
  placement = 'bottom-start',
}: ISelectProps<T>) {
  const selectedItemRef = useRef<ISelectItem>(
    labelInValue
      ? (value as ISelectItem)
      : {
          label: '',
          value: value as string,
        },
  );
  const [isOpen, setIsOpen] = useState(false);
  const changeOpenStatus = setIsOpen;
  // eslint-disable-next-line no-bitwise
  const context = useMemo(
    () => ({
      isOpen,
      changeOpenStatus,
      value,
      labelInValue,
      onValueChange: onChange,
      items,
      sections,
      selectedItemRef,
      title,
      placeholder,
      disabled,
      sheetProps,
      floatingPanelProps,
      placement,
    }),
    [
      isOpen,
      labelInValue,
      changeOpenStatus,
      value,
      onChange,
      items,
      sections,
      title,
      placeholder,
      disabled,
      sheetProps,
      floatingPanelProps,
      placement,
    ],
  );
  return (
    <SelectContext.Provider value={context as IContextType}>
      <Stack position="relative">{children}</Stack>
    </SelectContext.Provider>
  );
}

function BasicSelect<T extends string | ISelectItem>({
  renderTrigger,
  ...props
}: ISelectProps<T>) {
  const defaultRenderTrigger = useCallback(
    ({ label, value, placeholder, disabled }: ISelectRenderTriggerProps) => (
      <>
        <Input
          value={label}
          disabled={disabled}
          placeholder={placeholder}
          readonly
          flex={1}
          testID={`${props.testID || ''}-input`}
        />
        <Icon
          name="ChevronBottomSolid"
          position="absolute"
          right="$3"
          top="$2"
        />
      </>
    ),
    [],
  );
  return (
    <SelectFrame {...props}>
      <SelectTrigger renderTrigger={renderTrigger || defaultRenderTrigger} />
      <SelectContent />
    </SelectFrame>
  );
}

export const Select = withStaticProperties(BasicSelect, {
  Frame: SelectFrame,
  Trigger: SelectTrigger,
  Content: SelectContent,
});

export * from './type';
