import React, { ComponentProps, FC } from 'react';

import { Text as NBText } from 'native-base';
import { TextStyle } from 'react-native';

import { useIsVerticalLayout } from '../Provider/hooks';

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
  | 'Body2Strong'
  | 'Body2Underline'
  | 'CaptionStrong'
  | 'CaptionUnderline';

export type FontProps = ComponentProps<typeof NBText>;

export const Display2XLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: '700',
  fontSize: 32,
  lineHeight: 40,
};
export const DisplayXLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: '700',
  fontSize: 28,
  lineHeight: 36,
};
export const DisplayLargeProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: '600',
  fontSize: 24,
  lineHeight: 32,
};
export const DisplayMediumProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 20,
  lineHeight: 28,
};
export const DisplaySmallProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 16,
  lineHeight: 24,
};
export const PageHeadingProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: '500',
  fontSize: 24,
  lineHeight: 32,
};
export const HeadingProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '700',
  fontSize: 18,
  lineHeight: 28,
};
export const SubheadingProps: FontProps & Pick<TextStyle, 'textTransform'> = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: '700',
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
};
export const Button1Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 16,
  lineHeight: 24,
};
export const Button2Props = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 14,
  lineHeight: 20,
};
export const Body1Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
};
export const Body2Props = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
};
export const CaptionProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
};

export const Body1StrongProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 16,
  lineHeight: 24,
};

export const Body1UnderlineProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 16,
  lineHeight: 24,
  underline: true,
};

export const Body2StrongProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 14,
  lineHeight: 20,
};

export const Body2UnderlineProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 14,
  lineHeight: 20,
  underline: true,
};

export const CaptionStrongProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: '600',
  fontSize: 12,
  lineHeight: 16,
};

export const CaptionUnderlineProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: '400',
  fontSize: 12,
  lineHeight: 16,
  underline: true,
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
    'Body2Strong': Body2StrongProps,
    'Body2Underline': Body2UnderlineProps,
    'CaptionStrong': CaptionStrongProps,
    'CaptionUnderline': CaptionUnderlineProps,
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

type TextProps = {
  typography?:
    | TypographyStyle
    | { 'sm': TypographyStyle; 'md': TypographyStyle };
} & FontProps;

export const Text: FC<TextProps> = ({ typography, children, ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  let props;
  if (typography) {
    if (typeof typography === 'string') {
      props = getTypographyStyleProps(typography);
    } else {
      props = getTypographyStyleProps(
        isSmallScreen ? typography.sm : typography.md,
      );
    }
  }
  return (
    <NBText color="text-default" {...props} {...rest}>
      {children}
    </NBText>
  );
};

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
  Body2,
  Body2Strong,
  Body2Underline,
  Caption,
  CaptionStrong,
  CaptionUnderline,
  Text,
};

export default Typography;
