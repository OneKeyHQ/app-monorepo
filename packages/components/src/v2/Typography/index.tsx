import type { ComponentProps, FC } from 'react';

import { Text } from 'tamagui';

import type { TextStyle } from 'react-native';

export type TypographyStyle =
  | 'Display2XLarge'
  | 'DisplayXLarge'
  | 'DisplayLarge'
  | 'DisplayMedium'
  | 'DisplaySmall'
  | 'PageHeading'
  | 'Heading'
  | 'Subheading'
  | 'Button1'
  | 'Button2'
  | 'Body1'
  | 'Body2'
  | 'Caption'
  | 'Body1Strong'
  | 'Body1Underline'
  | 'Body1Mono'
  | 'Body2Strong'
  | 'Body2Underline'
  | 'Body2Mono'
  | 'CaptionStrong'
  | 'CaptionUnderline'
  | 'CaptionMono';

export type FontProps = ComponentProps<typeof Text>;

export const Display2XLargeProps: FontProps = {
  fontWeight: '600',
  fontSize: 32,
  lineHeight: 40,
};
export const DisplayXLargeProps: FontProps = {
  fontWeight: '600',
  fontSize: 28,
  lineHeight: 36,
};
export const DisplayLargeProps: FontProps = {
  fontWeight: '600',
  fontSize: 24,
  lineHeight: 32,
};
export const DisplayMediumProps: FontProps = {
  fontWeight: '500',
  fontSize: 20,
  lineHeight: 28,
};
export const DisplaySmallProps: FontProps = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};
export const PageHeadingProps: FontProps = {
  fontWeight: '600',
  fontSize: 24,
  lineHeight: 32,
};
export const HeadingProps: FontProps = {
  fontWeight: '600',
  fontSize: 18,
  lineHeight: 28,
};
export const SubheadingProps: FontProps & Pick<TextStyle, 'textTransform'> = {
  fontWeight: '600',
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
};
export const Button1Props: FontProps = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};
export const Button2Props: FontProps = {
  fontWeight: '500',
  fontSize: 14,
  lineHeight: 20,
};
export const Body1Props: FontProps = {
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
};
export const Body2Props: FontProps = {
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
};
export const CaptionProps: FontProps = {
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
};

export const Body1StrongProps: FontProps = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};

export const Body1UnderlineProps: FontProps = {
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
  textDecorationLine: 'underline',
};

export const Body1MonoProps: FontProps = {
  fontFamily: '$Roboto-Mono',
  fontSize: 16,
  lineHeight: 24,
};

export const Body2StrongProps: FontProps = {
  fontWeight: '500',
  fontSize: 14,
  lineHeight: 20,
};

export const Body2UnderlineProps: FontProps = {
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
  textDecorationLine: 'underline',
};

export const Body2MonoProps: FontProps = {
  fontFamily: '$Roboto-Mono',
  fontSize: 14,
  lineHeight: 20,
};

export const CaptionStrongProps: FontProps = {
  fontWeight: '500',
  fontSize: 12,
  lineHeight: 16,
};

export const CaptionUnderlineProps: FontProps = {
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
  textDecorationLine: 'underline',
};

export const CaptionMonoProps: FontProps = {
  fontFamily: '$Roboto-Mono',
  fontSize: 12,
  lineHeight: 16,
};

export const getTypographyStyleProps = (style: TypographyStyle): FontProps => {
  const propsMap: Record<TypographyStyle, FontProps> = {
    'Display2XLarge': Display2XLargeProps,
    'DisplayXLarge': DisplayXLargeProps,
    'DisplayLarge': DisplayLargeProps,
    'DisplayMedium': DisplayMediumProps,
    'DisplaySmall': DisplaySmallProps,
    'PageHeading': PageHeadingProps,
    'Heading': HeadingProps,
    'Subheading': SubheadingProps,
    'Button1': Button1Props,
    'Button2': Button2Props,
    'Body1': Body1Props,
    'Body2': Body2Props,
    'Caption': CaptionProps,
    'Body1Strong': Body1StrongProps,
    'Body1Underline': Body1UnderlineProps,
    'Body1Mono': Body1MonoProps,
    'Body2Strong': Body2StrongProps,
    'Body2Underline': Body2UnderlineProps,
    'Body2Mono': Body2MonoProps,
    'CaptionStrong': CaptionStrongProps,
    'CaptionUnderline': CaptionUnderlineProps,
    'CaptionMono': CaptionMonoProps,
  };
  return propsMap[style];
};

export const DisplayXLarge: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...DisplayXLargeProps} {...rest}>
    {children}
  </Text>
);
export const Display2XLarge: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Display2XLargeProps} {...rest}>
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
  <Text color="text-default" {...Body1UnderlineProps} {...rest}>
    {children}
  </Text>
);

export const Body1Mono: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body1MonoProps} {...rest}>
    {children}
  </Text>
);

export const Body2Strong: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2StrongProps} {...rest}>
    {children}
  </Text>
);

export const Body2Underline: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2UnderlineProps} {...rest}>
    {children}
  </Text>
);

export const Body2Mono: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...Body2MonoProps} {...rest}>
    {children}
  </Text>
);

export const CaptionStrong: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionStrongProps} {...rest}>
    {children}
  </Text>
);

export const CaptionUnderline: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionUnderlineProps} {...rest}>
    {children}
  </Text>
);

export const CaptionMono: FC<FontProps> = ({ children, ...rest }) => (
  <Text color="text-default" {...CaptionMonoProps} {...rest}>
    {children}
  </Text>
);

export const Typography = {
  Display2XLarge,
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
  Body1Strong,
  Body1Underline,
  Body1Mono,
  Body2,
  Body2Strong,
  Body2Underline,
  Body2Mono,
  Caption,
  CaptionStrong,
  CaptionUnderline,
  CaptionMono,
};
