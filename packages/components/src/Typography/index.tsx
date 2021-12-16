import React, { ComponentProps, FC } from 'react';

import { Text } from 'native-base';

type FontProps = ComponentProps<typeof Text>;

const DisplayXLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 28,
  lineHeight: 36,
};
const DisplayLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
const DisplayMediumProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 20,
  lineHeight: 28,
};
const DisplaySmallProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
const PageHeadingProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
const HeadingProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 18,
  lineHeight: 28,
};
const SUBHEADINGProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 12,
  lineHeight: 16,
};
const Button1Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
const Button2Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 14,
  lineHeight: 20,
};
const Body1Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 16,
  lineHeight: 24,
};
const Body2Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 14,
  lineHeight: 20,
};
const CaptionProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 12,
  lineHeight: 16,
};

export const DisplayXLarge: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...DisplayXLargeProps} {...rest}>
    {children}
  </Text>
);
export const DisplayLarge: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...DisplayLargeProps} {...rest}>
    {children}
  </Text>
);
export const DisplayMedium: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...DisplayMediumProps} {...rest}>
    {children}
  </Text>
);
export const DisplaySmall: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...DisplaySmallProps} {...rest}>
    {children}
  </Text>
);
export const PageHeading: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...PageHeadingProps} {...rest}>
    {children}
  </Text>
);
export const Heading: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...HeadingProps} {...rest}>
    {children}
  </Text>
);
export const SUBHEADING: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...SUBHEADINGProps} {...rest}>
    {children}
  </Text>
);
export const Button1: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Button1Props} {...rest}>
    {children}
  </Text>
);
export const Button2: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Button2Props} {...rest}>
    {children}
  </Text>
);

export const Body1: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body1Props} {...rest}>
    {children}
  </Text>
);
export const Body2: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2Props} {...rest}>
    {children}
  </Text>
);
export const Caption: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionProps} {...rest}>
    {children}
  </Text>
);

const Typography = {
  DisplayXLarge,
  DisplayLarge,
  DisplayMedium,
  DisplaySmall,
  PageHeading,
  Heading,
  SUBHEADING,
  Button1,
  Button2,
  Body1,
  Body2,
  Caption,
};

export default Typography;
