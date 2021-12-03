import { Text } from 'native-base';
import React from 'react';

type FontProps = {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: number;
};

const DisplayXLargeProps: FontProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 28,
  lineHeight: 36,
};
const DisplayLargeProps: FontProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
const DisplayMediumProps: FontProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 20,
  lineHeight: 28,
};
const DisplaySmallProps: FontProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
const PageHeadingProps: FontProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 24,
  lineHeight: 32,
};
const HeadingProps: FontProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 18,
  lineHeight: 28,
};
const SUBHEADINGProps: FontProps = {
  fontFamily: 'PlusJakartaSans-Bold',
  fontWeight: 'bold',
  fontSize: 12,
  lineHeight: 16,
};
const Button1Props: FontProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 16,
  lineHeight: 24,
};
const Button2Props: FontProps = {
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontWeight: 'semibold',
  fontSize: 14,
  lineHeight: 20,
};
const Body1Props: FontProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 16,
  lineHeight: 24,
};
const Body2Props: FontProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 14,
  lineHeight: 20,
};
const CaptionProps: FontProps = {
  fontFamily: 'PlusJakartaSans-Medium',
  fontWeight: 'medium',
  fontSize: 12,
  lineHeight: 16,
};

export const DisplayXLarge: React.FC = ({ children }) => (
  <Text {...DisplayXLargeProps}>{children}</Text>
);
export const DisplayLarge: React.FC = ({ children }) => (
  <Text {...DisplayLargeProps}>{children}</Text>
);
export const DisplayMedium: React.FC = ({ children }) => (
  <Text {...DisplayMediumProps}>{children}</Text>
);
export const DisplaySmall: React.FC = ({ children }) => (
  <Text {...DisplaySmallProps}>{children}</Text>
);
export const PageHeading: React.FC = ({ children }) => (
  <Text {...PageHeadingProps}>{children}</Text>
);
export const Heading: React.FC = ({ children }) => (
  <Text {...HeadingProps}>{children}</Text>
);
export const SUBHEADING: React.FC = ({ children }) => (
  <Text {...SUBHEADINGProps}>{children}</Text>
);
export const Button1: React.FC = ({ children }) => (
  <Text {...Button1Props}>{children}</Text>
);
export const Button2: React.FC = ({ children }) => (
  <Text {...Button2Props}>{children}</Text>
);

export const Body1: React.FC = ({ children }) => (
  <Text {...Body1Props}>{children}</Text>
);
export const Body2: React.FC = ({ children }) => (
  <Text {...Body2Props}>{children}</Text>
);
export const Caption: React.FC = ({ children }) => (
  <Text {...CaptionProps}>{children}</Text>
);
export default {
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
