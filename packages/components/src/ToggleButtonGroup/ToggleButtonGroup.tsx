import { FC, ReactElement, useCallback, useEffect, useRef } from 'react';

import { ScrollView } from 'react-native';

import {
  Center,
  ICON_NAMES,
  Icon,
  NetImage,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

export interface ToggleButtonProps {
  text: string;
  leftIcon?: ICON_NAMES;
  leftImage?: string;
  leftComponent?: () => ReactElement;
}

interface ToggleButtonGroupProps {
  buttons: ToggleButtonProps[];
  selectedIndex: number;
  onButtonPress: (index: number) => void;
  leftIconSize?: number;
}
const ToggleButton: FC<
  ToggleButtonProps & {
    isCurrent?: boolean;
    onPress: () => void;
    leftIconSize?: number;
  }
> = ({
  text,
  leftIcon,
  leftImage,
  leftComponent,
  isCurrent,
  onPress,
  leftIconSize,
}) => {
  const isVertical = useIsVerticalLayout();
  const iconSize = leftIconSize || (isVertical ? '16px' : '20px');
  return (
    <Pressable
      _hover={{
        bg: 'action-secondary-hovered',
      }}
      h={isVertical ? '32px' : '36px'}
      px={isVertical ? '8px' : '12px'}
      py={isVertical ? '6px' : '8px'}
      mr="8px"
      bg={isCurrent ? 'surface-selected' : 'background-default'}
      borderRadius={isCurrent ? '9999px' : undefined}
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      onPress={onPress}
    >
      <Center borderRadius="50%" w={iconSize} h={iconSize} mr="8px">
        {!!leftIcon && (
          <Icon
            name={leftIcon}
            size={iconSize}
            color={isCurrent ? 'icon-hovered' : 'icon-default'}
          />
        )}
        {!!leftImage && (
          <NetImage height={iconSize} width={iconSize} src={leftImage} />
        )}
      </Center>
      {!!leftComponent && leftComponent}
      <Typography.Body2Strong
        maxW="82px"
        isTruncated
        color={isCurrent ? 'text-default' : 'text-subdued'}
      >
        {text}
      </Typography.Body2Strong>
    </Pressable>
  );
};

const ToggleButtonGroup: FC<ToggleButtonGroupProps> = ({
  buttons,
  selectedIndex,
  onButtonPress,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const scollToEnd = useCallback(
    () => setTimeout(() => scrollRef.current?.scrollToEnd(), 30),
    [],
  );
  useEffect(() => {
    //     if (tabs.length > lastTabsLength.current) {
    //     }
    //     lastTabsLength.current = tabs.length;
  }, [selectedIndex]);
  return (
    <ScrollView
      ref={scrollRef}
      style={{
        width: '100%',
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {buttons.map((btn, index) => (
        <ToggleButton
          key={index}
          isCurrent={selectedIndex === index}
          {...btn}
          onPress={() => onButtonPress(index)}
        />
      ))}
    </ScrollView>
  );
};
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export default ToggleButtonGroup;
