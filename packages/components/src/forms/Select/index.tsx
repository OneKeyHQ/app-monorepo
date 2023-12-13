import { useCallback, useContext, useMemo, useState } from 'react';

import { useMedia, withStaticProperties } from 'tamagui';

import { Popover, Trigger } from '../../actions';
import { ListView, SectionList } from '../../layouts';
import { Heading, Icon, SizableText, Stack, XStack } from '../../primitives';
import { Input } from '../Input';

import { SelectContext } from './context';

import type {
  ISelectItem,
  ISelectItemProps,
  ISelectProps,
  ISelectRenderTriggerProps,
  ISelectSection,
  ISelectTriggerProps,
} from './type';
import type { IListViewProps, ISectionListProps } from '../../layouts';

function SelectTrigger({ renderTrigger: RenderTrigger }: ISelectTriggerProps) {
  const { changeOpenStatus, value, placeholder, disabled } =
    useContext(SelectContext);
  const handleTriggerPressed = useCallback(() => {
    changeOpenStatus?.(true);
  }, [changeOpenStatus]);
  return (
    <Trigger onPress={handleTriggerPressed} disabled={disabled}>
      {RenderTrigger ? (
        <RenderTrigger
          value={value}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <SizableText>{value}</SizableText>
      )}
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
    onSelect(value);
  }, [onSelect, value]);
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
  } = useContext(SelectContext);
  const handleSelect = useCallback(
    (itemValue: string) => {
      onValueChange?.(itemValue);
      changeOpenStatus?.(false);
    },
    [changeOpenStatus, onValueChange],
  );

  const handleFocusOutside = useCallback(() => {
    changeOpenStatus?.(false);
  }, [changeOpenStatus]);

  const handleOpenChange = useCallback(
    (openStatus: boolean) => {
      changeOpenStatus?.(openStatus);
    },
    [changeOpenStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: ISelectItem }) => (
      <SelectItem {...item} onSelect={handleSelect} selectedValue={value} />
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

  const keyExtractor = useCallback((item: ISelectItem) => item.value, []);

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
  return (
    <Popover
      title={title || ''}
      open={isOpen}
      onOpenChange={handleOpenChange}
      onFocusOutside={handleFocusOutside}
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
      placement="bottom-start"
      renderTrigger={<Stack pointerEvents="none" />}
      renderContent={renderContent}
    />
  );
}

function SelectFrame({
  items,
  placeholder,
  value,
  onChange,
  children,
  title,
  disabled,
  sections,
  sheetProps,
}: ISelectProps) {
  const [openCounts, updateOpenCounts] = useState(0);
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
      onValueChange: onChange,
      items,
      sections,
      title,
      placeholder,
      disabled,
      sheetProps,
    }),
    [
      isOpen,
      refreshState,
      changeOpenStatus,
      value,
      onChange,
      items,
      sections,
      title,
      placeholder,
      disabled,
      sheetProps,
    ],
  );
  return (
    <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
  );
}

function BasicSelect({ renderTrigger, ...props }: ISelectProps) {
  const defaultRenderTrigger = useCallback(
    ({ value, placeholder, disabled }: ISelectRenderTriggerProps) => (
      <>
        <Input
          value={value}
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
