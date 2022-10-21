import {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { LayoutChangeEvent, ScrollView } from 'react-native';

import {
  Box,
  Center,
  ICON_NAMES,
  Icon,
  IconButton,
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
    leftIconSize?: number | string;
    onLayout: (e: LayoutChangeEvent) => void;
  }
> = ({
  text,
  leftIcon,
  leftImage,
  leftComponent,
  isCurrent,
  onPress,
  leftIconSize,
  onLayout,
}) => {
  const isVertical = useIsVerticalLayout();
  const iconSize = leftIconSize || (isVertical ? '16px' : '20px');
  return (
    <Pressable
      _hover={{
        bg: 'surface-selected',
      }}
      h={isVertical ? '32px' : '36px'}
      px={isVertical ? '8px' : '12px'}
      py={isVertical ? '6px' : '8px'}
      mr="8px"
      bg={isCurrent ? 'surface-selected' : 'transparent'}
      borderRadius="9999px"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      onPress={onPress}
      onLayout={onLayout}
    >
      {!!leftIcon || !!leftImage ? (
        <Center borderRadius="9999px" w={iconSize} h={iconSize} mr="8px">
          {!!leftIcon && (
            <Icon
              name={leftIcon}
              color={isCurrent ? 'icon-hovered' : 'icon-default'}
            />
          )}
          {!!leftImage && (
            <NetImage height={iconSize} width={iconSize} src={leftImage} />
          )}
        </Center>
      ) : null}
      {!!leftComponent && leftComponent}
      <Typography.Body2Strong
        // maxW="82px"
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
  const [showRightArrow, setShowRightArrow] = useState(false);
  const buttonLayouts = useRef<{ x: number; width: number }[]>([]);
  const scrollTo = useCallback((index: number) => {
    const x = buttonLayouts.current[index - 1 < 0 ? 0 : index - 1]?.x;
    if (x !== undefined) {
      scrollRef.current?.scrollTo({
        x,
        animated: true,
      });
    }
  }, []);
  useEffect(() => {
    setTimeout(() => {
      scrollTo(selectedIndex);
    }, 50);
  }, [scrollTo, selectedIndex]);

  return (
    <Box
      w="full"
      flexDirection="row"
      alignItems="center"
      onLayout={({
        nativeEvent: {
          layout: { width },
        },
      }) => {
        const allButtonsWidth = buttonLayouts.current.reduce(
          (acc, cur) => acc + cur.width + 8, // 8px margin
          0,
        );
        setShowRightArrow(width < allButtonsWidth);
      }}
    >
      <ScrollView
        ref={scrollRef}
        style={{
          flex: 1,
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {buttons.map((btn, index) => (
          <ToggleButton
            key={index}
            isCurrent={selectedIndex === index}
            {...btn}
            onPress={() => {
              scrollTo(index);
              onButtonPress(index);
            }}
            onLayout={({
              nativeEvent: {
                layout: { width, x },
              },
            }) => (buttonLayouts.current[index] = { x, width })}
          />
        ))}
      </ScrollView>
      {showRightArrow && (
        <IconButton
          onPress={() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
          type="plain"
          size="sm"
          name="ChevronRightSolid"
        />
      )}
    </Box>
  );
};
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export default ToggleButtonGroup;
