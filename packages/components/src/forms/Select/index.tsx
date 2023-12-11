import { useCallback, useContext, useMemo, useState } from 'react';

import { useMedia, withStaticProperties } from 'tamagui';

import { Popover, Trigger } from '../../actions';
import { useSafeAreaInsets } from '../../hooks';
import { ListView } from '../../layouts';
import { Icon, Stack, Text, YStack } from '../../primitives';

import { SelectContext } from './context';

import type {
  ISelectItem,
  ISelectItemProps,
  ISelectProps,
  ISelectRenderTriggerProps,
  ISelectTriggerProps,
} from './type';

function SelectTrigger({ renderTrigger: RenderTrigger }: ISelectTriggerProps) {
  const { changeOpenStatus, value, placeholder } = useContext(SelectContext);
  const handleTriggerPressed = useCallback(() => {
    changeOpenStatus?.(true);
  }, [changeOpenStatus]);
  return (
    <Trigger onPress={handleTriggerPressed}>
      {RenderTrigger ? (
        <RenderTrigger value={value} placeholder={placeholder} />
      ) : (
        <Text>{value}</Text>
      )}
    </Trigger>
  );
}

function SelectItem({ onSelect, value, label, leading }: ISelectItemProps) {
  const { value: selectedValue } = useContext(SelectContext);
  const media = useMedia();
  const handleSelect = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);
  return useMemo(
    () => (
      <YStack
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

        <Icon
          name="CheckLargeOutline"
          size="$4"
          color="$iconActive"
          {...(media.md && {
            name: 'CheckRadioSolid',
            size: '$6',
          })}
        />
      </YStack>
    ),
    [handleSelect, label, media.md, value],
  );
}

function SelectContent() {
  const { changeOpenStatus, value, isOpen, items, onValueChange } =
    useContext(SelectContext);

  const handleSelect = useCallback(
    (itemValue: string) => {
      onValueChange?.(itemValue);
      setTimeout(() => {
        changeOpenStatus?.(false);
      }, 10);
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
      <SelectItem {...item} onSelect={handleSelect} />
    ),
    [handleSelect],
  );
  return (
    <Popover
      title=""
      open={isOpen}
      onOpenChange={handleOpenChange}
      onFocusOutside={handleFocusOutside}
      placement="bottom-start"
      renderTrigger={<Stack pointerEvents="none" />}
      renderContent={
        <ListView
          data={items}
          estimatedItemSize="$16"
          extraData={value}
          renderItem={renderItem}
        />
      }
    />
  );
}

function SelectFrame({
  items,
  placeholder,
  value,
  onChange,
  children,
}: ISelectProps) {
  const [isOpen, changeOpenStatus] = useState(false);
  const context = useMemo(
    () => ({
      isOpen,
      changeOpenStatus,
      value,
      onValueChange: onChange,
      items,
      placeholder,
    }),
    [isOpen, items, onChange, value, placeholder],
  );
  return (
    <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
  );
}

function BasicSelect(props: ISelectProps) {
  return (
    <SelectFrame {...props}>
      <SelectTrigger
        renderTrigger={({ value, placeholder }: ISelectRenderTriggerProps) => (
          <Text>{value || placeholder}</Text>
        )}
      />
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
