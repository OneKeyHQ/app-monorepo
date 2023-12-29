import { styled, withStaticProperties } from 'tamagui';

import { Icon, SizableText, Stack, XStack } from '../../primitives';

import type {
  IImageProps,
  IKeyOfIcons,
  ISizableTextProps,
} from '../../primitives';
import type { XStackProps } from 'tamagui';

const DescriptionListFrame = styled(Stack, {
  name: 'DescriptionList',
  space: '$4',
});

const DescriptionListItem = styled(XStack, {
  name: 'DescriptionListItem',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const DescriptionListItemKey = styled(SizableText, {
  name: 'DescriptionListItemKey',
  size: '$bodyMd',
  color: '$textSubdued',
});

// const DescriptionListItemValue = styled(SizableText, {
//   name: 'DescriptionListItemValue',
//   size: '$bodyMdMedium',
//   textAlign: 'right',
// });

// const DescriptionListItemIcon = styled(Icon, {
//   color: '$iconSubdued',
//   size: '$4',
// });

type IDescriptionListItemValue = {
  source?: IImageProps['source'];
  textProps?: ISizableTextProps;
  icon?: IKeyOfIcons;
  iconAfter?: IKeyOfIcons;
};

const DescriptionListItemValue = ({
  children,
  source,
  textProps,
  icon,
  iconAfter,
  onPress,
  ...rest
}: IDescriptionListItemValue & XStackProps) => (
  <XStack
    alignItems="center"
    onPress={onPress}
    {...(onPress && {
      userSelect: 'none',
      hoverStyle: {
        opacity: 0.6,
      },
      '$platform-native': {
        hitSlop: {
          top: 8,
          right: 8,
          bottom: 8,
          left: 8,
        },
      },
    })}
    {...rest}
  >
    {icon && <Icon mr="$1" color="$iconSubdued" name={icon} size="$4" />}
    <SizableText size="$bodyMdMedium" textAlign="right" {...textProps}>
      {children}
    </SizableText>
    {iconAfter && (
      <Icon ml="$1" color="$iconSubdued" name={iconAfter} size="$4" />
    )}
  </XStack>
);

DescriptionListItemValue.displayName = 'DescriptionListItemValue';

export const DescriptionList = withStaticProperties(DescriptionListFrame, {
  Item: withStaticProperties(DescriptionListItem, {
    Key: DescriptionListItemKey,
    Value: DescriptionListItemValue,
  }),
});
