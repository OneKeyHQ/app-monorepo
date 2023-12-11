import { useCallback, useContext, useMemo, useState } from 'react';

import { useMedia, withStaticProperties } from 'tamagui';

import { Popover, Trigger } from '../../actions';
import { useSafeAreaInsets } from '../../hooks';
import { ListView, SectionList } from '../../layouts';
import { Icon, Stack, Text, XStack, YStack } from '../../primitives';
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
        <Text>{value}</Text>
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
        minHeight="auto"
        backgroundColor="$transparent"
        borderRadius="$2"
        paddingVertical="$1.5"
        paddingHorizontal="$2"
        $md={{
          paddingVertical: '$2.5',
          paddingRight: 11,
        }}
        onPress={handleSelect}
      >
        {leading ? (
          <Stack alignContent="center" justifyContent="center" pr="$4">
            {leading}
          </Stack>
        ) : null}
        <Text
          flex={1}
          $md={{
            fontSize: '$bodyLg',
            fontWeight: '$bodyLg',
            lineHeight: '$bodyLg',
          }}
          fontSize="$bodyMd"
          fontWeight="$bodyMd"
          lineHeight="$bodyMd"
        >
          {label}
        </Text>
        {selectedValue === value ? (
          <Icon
            name="CheckLargeOutline"
            size="$4"
            color="$iconActive"
            {...(md && {
              name: 'CheckRadioSolid',
              size: '$6',
            })}
          />
        ) : null}
      </XStack>
    ),
    [handleSelect, label, md, selectedValue, value],
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
  } = useContext(SelectContext);
  const { md } = useMedia();
  const handleSelect = useCallback(
    (itemValue: string) => {
      onValueChange?.(itemValue);
      if (md) {
        setTimeout(() => {
          changeOpenStatus?.(false);
        }, 200);
      }
    },
    [changeOpenStatus, md, onValueChange],
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
      <Text
        variant="$headingXs"
        $md={{ variant: '$headingSm', paddingVertical: '$2.5' }}
        paddingVertical="$1.5"
        paddingHorizontal="$2"
        color="$textSubdued"
      >
        {section.title}
      </Text>
    ),
    [],
  );

  const renderContent = sections ? (
    <SectionList
      sections={sections}
      contentContainerStyle={{
        px: '$4',
      }}
      renderSectionHeader={renderSectionHeader}
      estimatedItemSize="$4"
      extraData={value}
      renderItem={renderItem}
    />
  ) : (
    <ListView
      data={items}
      contentContainerStyle={{
        px: '$4',
      }}
      estimatedItemSize="$4"
      extraData={value}
      renderItem={renderItem}
    />
  );
  return (
    <Popover
      title={title || ''}
      open={isOpen}
      onOpenChange={handleOpenChange}
      onFocusOutside={handleFocusOutside}
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
}: ISelectProps) {
  const [isOpen, changeOpenStatus] = useState(false);
  const context = useMemo(
    () => ({
      isOpen,
      changeOpenStatus,
      value,
      onValueChange: onChange,
      items,
      sections,
      title,
      placeholder,
      disabled,
    }),
    [isOpen, value, onChange, items, sections, title, placeholder, disabled],
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
