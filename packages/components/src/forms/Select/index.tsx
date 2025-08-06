import { useCallback, useContext, useMemo, useState } from 'react';

import { Keyboard } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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
import type { GestureResponderEvent } from 'react-native';

const useTriggerLabel = (value: string | number | undefined | boolean) => {
  const { sections, items } = useContext(SelectContext);
  return useMemo(() => {
    if (!value) {
      return '';
    }

    if (sections) {
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        for (let j = 0; j < section.data.length; j += 1) {
          const item = section.data[j];
          if (item.value === value) {
            return item.label;
          }
        }
      }
    }

    if (items) {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.value === value) {
          return item.label;
        }
      }
    }

    return '';
  }, [items, sections, value]);
};

function SelectTrigger({ renderTrigger }: ISelectTriggerProps) {
  const { changeOpenStatus, value, placeholder, disabled, labelInValue } =
    useContext(SelectContext);

  const handleTriggerPressed = useCallback(() => {
    if (platformEnv.isNative && Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(() => {
        changeOpenStatus?.(true);
      }, 100);
    } else {
      changeOpenStatus?.(true);
    }
  }, [changeOpenStatus]);
  const renderTriggerOnPress = useCallback(
    (event: GestureResponderEvent) => {
      handleTriggerPressed();
      event.stopPropagation();
    },
    [handleTriggerPressed],
  );
  const renderValue = labelInValue
    ? (value as ISelectItem)?.value
    : (value as string);
  const label = useTriggerLabel(renderValue);
  return (
    <Trigger onPress={handleTriggerPressed} disabled={disabled}>
      {renderTrigger({
        onPress: renderTriggerOnPress,
        value: renderValue,
        label,
        placeholder,
        disabled,
      })}
    </Trigger>
  );
}

function SelectItemView({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <>
      <SizableText
        $gtMd={{
          size: '$bodyMd',
        }}
        numberOfLines={2}
      >
        {label}
      </SizableText>
      {description ? (
        <SizableText
          mt="$0.5"
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={2}
        >
          {description}
        </SizableText>
      ) : null}
    </>
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
        key={String(value)}
        px="$2"
        py="$1.5"
        borderRadius="$2"
        $md={{
          py: '$2.5',
          borderRadius: '$3',
        }}
        borderCurve="continuous"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handleSelect}
        testID={testID}
        alignItems="center"
      >
        {leading ? (
          <Stack alignContent="center" justifyContent="center" pr="$3">
            {leading}
          </Stack>
        ) : null}
        <Stack flex={1} userSelect="none">
          <SelectItemView label={label} description={description} />
        </Stack>
        {selectedValue === value ? (
          <Icon
            flexShrink={0}
            ml="$2"
            alignSelf="center"
            name="CheckLargeOutline"
            size="$4"
            color="$iconActive"
            {...(md && {
              name: 'CheckRadioSolid',
              size: '$6',
              mr: '$0.5',
            })}
          />
        ) : (
          <Stack w="$8" h={1} />
        )}
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

const requestIdleCallback = (callback: () => void) => {
  setTimeout(callback, 150);
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
    offset,
  } = useContext(SelectContext);
  const handleSelect = useCallback(
    (item: ISelectItem) => {
      changeOpenStatus?.(false);
      requestIdleCallback(() => {
        onValueChange?.(labelInValue ? item : item.value);
      });
    },
    [changeOpenStatus, labelInValue, onValueChange],
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
        testID={`select-item-${String(item.value)}`}
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
      `${String(item.value)}-${item.label}-${index}`,
    [],
  );

  const renderContent = useMemo(
    () => {
      const listProps = {
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
          {...(listProps as any)}
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
  const usingPercentSnapPoints = items?.length && items?.length > 10;
  return (
    <Popover
      title={title || ''}
      open={isOpen}
      onOpenChange={handleOpenChange}
      keepChildrenMounted={!platformEnv.isNative}
      sheetProps={{
        dismissOnSnapToBottom: true,
        snapPointsMode: usingPercentSnapPoints ? 'percent' : 'fit',
        snapPoints: usingPercentSnapPoints ? [60] : undefined,
        ...sheetProps,
      }}
      floatingPanelProps={{
        maxHeight: platformEnv.isNative ? undefined : '60vh',
        width: '$56',
        ...floatingPanelProps,
      }}
      placement={placement}
      renderTrigger={popoverTrigger}
      renderContent={renderContent}
      offset={offset}
    />
  );
}

function SelectFrame<
  T extends string | number | boolean | undefined | ISelectItem,
>({
  items,
  placeholder,
  value,
  onChange,
  onOpenChange,
  children,
  title,
  disabled,
  sections,
  sheetProps,
  offset,
  labelInValue = false,
  floatingPanelProps,
  placement = 'bottom-start',
}: ISelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const changeOpenStatus = useCallback(
    (openStatus: boolean) => {
      setIsOpen(openStatus);
      void timerUtils.setTimeoutPromised(() => {
        onOpenChange?.(openStatus);
      });
    },
    [onOpenChange],
  );
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
      title,
      placeholder,
      disabled,
      sheetProps,
      floatingPanelProps,
      placement,
      offset,
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
      offset,
    ],
  );
  return (
    <SelectContext.Provider value={context as IContextType}>
      <Stack position="relative">{children}</Stack>
    </SelectContext.Provider>
  );
}

function BasicSelect<
  T extends string | number | boolean | undefined | ISelectItem,
>({
  renderTrigger,
  testID = '',
  defaultTriggerInputProps,
  ...props
}: ISelectProps<T>) {
  const media = useMedia();
  const defaultRenderTrigger = useCallback(
    ({ label, placeholder, disabled }: ISelectRenderTriggerProps) => (
      <>
        <Input
          value={label}
          disabled={disabled}
          placeholder={placeholder}
          readonly
          flex={1}
          testID={`${testID}-input`}
          {...defaultTriggerInputProps}
        />
        {/* <Icon
          name="ChevronBottomSolid"
          position="absolute"
          right="$3"
          top="$2"
        /> */}
        <Icon
          name="ChevronDownSmallOutline"
          color="$iconSubdued"
          position="absolute"
          right="$3"
          top={media.gtMd ? '$2' : '$3'}
        />
      </>
    ),
    [defaultTriggerInputProps, media.gtMd, testID],
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
  Item: SelectItemView,
});

export * from './type';
