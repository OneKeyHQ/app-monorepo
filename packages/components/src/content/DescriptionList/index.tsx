import { styled, withStaticProperties } from 'tamagui';

import { Icon, Image, SizableText, Stack, XStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils';

import type {
  IImageProps,
  IKeyOfIcons,
  ISizableTextProps,
} from '../../primitives';
import type { XStackProps } from 'tamagui';

const DescriptionListFrame = styled(Stack, {
  name: 'DescriptionList',
  gap: '$4',
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
    hitSlop={NATIVE_HIT_SLOP}
    {...(onPress && {
      userSelect: 'none',
      hoverStyle: {
        opacity: 0.6,
      },
    })}
    {...rest}
  >
    {source ? <Image width="$5" height="$5" source={source} /> : null}
    {icon ? <Icon mr="$1" color="$iconSubdued" name={icon} size="$4" /> : null}
    <SizableText size="$bodyMdMedium" textAlign="right" {...textProps}>
      {children}
    </SizableText>
    {iconAfter ? (
      <Icon ml="$1" color="$iconSubdued" name={iconAfter} size="$4" />
    ) : null}
  </XStack>
);

DescriptionListItemValue.displayName = 'DescriptionListItemValue';

export const DescriptionList = withStaticProperties(DescriptionListFrame, {
  Item: withStaticProperties(DescriptionListItem, {
    Key: DescriptionListItemKey,
    Value: DescriptionListItemValue,
  }),
});
