import React, { ComponentProps, FC } from 'react';

import { Text } from 'native-base';

type FontProps = ComponentProps<typeof Text>;

export const DisplayXLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 28,
  lineHeight: 36,
};
export const DisplayLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
export const DisplayMediumProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 20,
  lineHeight: 28,
};
export const DisplaySmallProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
export const PageHeadingProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
export const HeadingProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 18,
  lineHeight: 28,
};
export const SubheadingProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 12,
  lineHeight: 16,
};
export const Button1Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
export const Button2Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 14,
  lineHeight: 20,
};
export const Body1Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 16,
  lineHeight: 24,
};
export const Body2Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 14,
  lineHeight: 20,
};
export const CaptionProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 12,
  lineHeight: 16,
};

const Body1StrongProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};

const Body1UnderlineProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 16,
  lineHeight: 24,
};

const Body2StrongProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'semibold',
  fontSize: 14,
  lineHeight: 20,
};

const Body2UnderlineProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 14,
  lineHeight: 20,
};

const CaptionStrongProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'semibold',
  fontSize: 12,
  lineHeight: 16,
};

const CaptionUnderlineProps = {
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
export const Subheading: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...SubheadingProps} {...rest}>
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

export const Body1Strong: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body1StrongProps} {...rest}>
    {children}
  </Text>
);

export const Body1Underline: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body1UnderlineProps} {...rest} underline>
    {children}
  </Text>
);

export const Body2Strong: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2StrongProps} {...rest}>
    {children}
  </Text>
);

export const Body2Underline: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2UnderlineProps} {...rest} underline>
    {children}
  </Text>
);

export const CaptionStrong: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionStrongProps} {...rest}>
    {children}
  </Text>
);

export const CaptionUnderline: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionUnderlineProps} {...rest} underline>
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
  Subheading,
  Button1,
  Button2,
  Body1,
  Body2,
  Caption,
  Body1Strong,
  Body1Underline,
  Body2Strong,
  Body2Underline,
  CaptionStrong,
  CaptionUnderline,
};

export default Typography;
