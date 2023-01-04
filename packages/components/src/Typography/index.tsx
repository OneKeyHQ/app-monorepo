import type { ComponentProps, FC } from 'react';

import { Text as NBText } from 'native-base';

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

export type FontProps = ComponentProps<typeof NBText>;

export const Display2XLargeProps = {
  fontWeight: '600',
  fontSize: 32,
  lineHeight: 40,
};
export const DisplayXLargeProps = {
  fontWeight: '600',
  fontSize: 28,
  lineHeight: 36,
};
export const DisplayLargeProps = {
  fontWeight: '600',
  fontSize: 24,
  lineHeight: 32,
};
export const DisplayMediumProps = {
  fontWeight: '500',
  fontSize: 20,
  lineHeight: 28,
};
export const DisplaySmallProps = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};
export const PageHeadingProps = {
  fontWeight: '600',
  fontSize: 24,
  lineHeight: 32,
};
export const HeadingProps = {
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
export const Button1Props = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};
export const Button2Props = {
  fontWeight: '500',
  fontSize: 14,
  lineHeight: 20,
};
export const Body1Props = {
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
};
export const Body2Props = {
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
};
export const CaptionProps = {
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
};

export const Body1StrongProps = {
  fontWeight: '500',
  fontSize: 16,
  lineHeight: 24,
};

export const Body1UnderlineProps = {
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
  underline: true,
};

export const Body1MonoProps = {
  fontFamily: 'Roboto-Mono',
  fontSize: 16,
  lineHeight: 24,
};

export const Body2StrongProps = {
  fontWeight: '500',
  fontSize: 14,
  lineHeight: 20,
};

export const Body2UnderlineProps = {
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
  underline: true,
};

export const Body2MonoProps = {
  fontFamily: 'Roboto-Mono',
  fontSize: 14,
  lineHeight: 20,
};

export const CaptionStrongProps = {
  fontWeight: '500',
  fontSize: 12,
  lineHeight: 16,
};

export const CaptionUnderlineProps = {
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
  underline: true,
};

export const CaptionMonoProps = {
  fontFamily: 'Roboto-Mono',
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
  <NBText color="text-default" {...DisplayXLargeProps} {...rest}>
    {children}
  </NBText>
);
export const Display2XLarge: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Display2XLargeProps} {...rest}>
    {children}
  </NBText>
);
export const DisplayLarge: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...DisplayLargeProps} {...rest}>
    {children}
  </NBText>
);
export const DisplayMedium: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...DisplayMediumProps} {...rest}>
    {children}
  </NBText>
);
export const DisplaySmall: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...DisplaySmallProps} {...rest}>
    {children}
  </NBText>
);
export const PageHeading: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...PageHeadingProps} {...rest}>
    {children}
  </NBText>
);
export const Heading: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...HeadingProps} {...rest}>
    {children}
  </NBText>
);
export const Subheading: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...SubheadingProps} {...rest}>
    {children}
  </NBText>
);
export const Button1: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Button1Props} {...rest}>
    {children}
  </NBText>
);
export const Button2: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Button2Props} {...rest}>
    {children}
  </NBText>
);

export const Body1: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body1Props} {...rest}>
    {children}
  </NBText>
);
export const Body2: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body2Props} {...rest}>
    {children}
  </NBText>
);
export const Caption: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...CaptionProps} {...rest}>
    {children}
  </NBText>
);

export const Body1Strong: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body1StrongProps} {...rest}>
    {children}
  </NBText>
);

export const Body1Underline: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body1UnderlineProps} {...rest}>
    {children}
  </NBText>
);

export const Body1Mono: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body1MonoProps} {...rest}>
    {children}
  </NBText>
);

export const Body2Strong: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body2StrongProps} {...rest}>
    {children}
  </NBText>
);

export const Body2Underline: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body2UnderlineProps} {...rest}>
    {children}
  </NBText>
);

export const Body2Mono: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...Body2MonoProps} {...rest}>
    {children}
  </NBText>
);

export const CaptionStrong: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...CaptionStrongProps} {...rest}>
    {children}
  </NBText>
);

export const CaptionUnderline: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...CaptionUnderlineProps} {...rest}>
    {children}
  </NBText>
);

export const CaptionMono: FC<FontProps> = ({ children, ...rest }) => (
  <NBText color="text-default" {...CaptionMonoProps} {...rest}>
    {children}
  </NBText>
);

const Typography = {
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

export default Typography;
