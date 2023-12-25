import { useCallback, useContext, useMemo, useRef, useState } from 'react';

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
      >
        {leading ? (
          <Stack alignContent="center" justifyContent="center" pr="$4">
            {leading}
          </Stack>
        ) : null}
        <SizableText
          userSelect="none"
          $gtMd={{
            size: '$bodyMd',
          }}
        >
          {label}
        </SizableText>
        {selectedValue === value ? (
          <Icon
            ml="auto"
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
    [handleSelect, label, leading, md, selectedValue, value],
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
    refreshState,
    sheetProps,
    placement,
    labelInValue,
    selectedItemRef,
  } = useContext(SelectContext);
  const handleSelect = useCallback(
    (item: ISelectItem) => {
      selectedItemRef.current.value = item.value;
      selectedItemRef.current.label = item.label;
      onValueChange?.(labelInValue ? item : item.value);
      changeOpenStatus?.(false);
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
    (item: ISelectItem, index: number) => `${item.value}-${item.label}-${index}`,
    [],
  );

  const renderContent = useMemo(
    () => {
      const listProps = {
        contentContainerStyle: { flex: 1 },
        keyExtractor,
        estimatedItemSize: '$6',
        extraData: value,
        renderItem,
        p: '$1',
        $md: { p: '$3' },
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
    [refreshState],
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
  placement = 'bottom-start',
}: ISelectProps<T>) {
  const [openCounts, updateOpenCounts] = useState(0);
  const selectedItemRef = useRef<ISelectItem>(
    labelInValue
      ? (value as ISelectItem)
      : {
          label: '',
          value: value as string,
        },
  );
  const changeOpenStatus = useCallback(() => {
    updateOpenCounts((i) => i + 1);
  }, []);
  // eslint-disable-next-line no-bitwise
  const isOpen = useMemo(() => (openCounts & 1) === 1, [openCounts]);
  const refreshState = useMemo(
    () => (isOpen ? openCounts : openCounts - 1),
    [isOpen, openCounts],
  );
  const context = useMemo(
    () => ({
      isOpen,
      refreshState,
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
      placement,
    }),
    [
      isOpen,
      refreshState,
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
    ({ label, placeholder, disabled }: ISelectRenderTriggerProps) => (
      <>
        <Input
          value={label}
          disabled={disabled}
          placeholder={placeholder}
          readonly
          flex={1}
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
