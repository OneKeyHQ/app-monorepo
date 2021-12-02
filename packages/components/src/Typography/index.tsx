import { Text } from 'native-base';
import React from 'react';
export const DisplayXLarge: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Bold"
    fontSize={28}
    fontWeight="bold"
    lineHeight={36}
  >
    {children}
  </Text>
);

export const DisplayLarge: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Bold"
    fontSize={24}
    fontWeight="bold"
    lineHeight={32}
  >
    {children}
  </Text>
);

export const DisplayMedium: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-SemiBold"
    fontSize={20}
    fontWeight="semibold"
    lineHeight={28}
  >
    {children}
  </Text>
);

export const DisplaySmall: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-SemiBold"
    fontSize={16}
    fontWeight="semibold"
    lineHeight={24}
  >
    {children}
  </Text>
);

export const PageHeading: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Bold"
    fontSize={24}
    fontWeight="bold"
    lineHeight={32}
  >
    {children}
  </Text>
);

export const Heading: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-SemiBold"
    fontSize={18}
    fontWeight="semibold"
    lineHeight={28}
  >
    {children}
  </Text>
);

export const SUBHEADING: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Bold"
    fontSize={12}
    fontWeight="bold"
    lineHeight={16}
  >
    {children}
  </Text>
);

export const Button1: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-SemiBold"
    fontSize={16}
    fontWeight="semibold"
    lineHeight={24}
  >
    {children}
  </Text>
);

export const Button2: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-SemiBold"
    fontSize={14}
    fontWeight="semibold"
    lineHeight={20}
  >
    {children}
  </Text>
);

export const Body1: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Medium"
    fontSize={16}
    fontWeight="medium"
    lineHeight={24}
  >
    {children}
  </Text>
);

export const Body2: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Medium"
    fontSize={14}
    fontWeight="medium"
    lineHeight={20}
  >
    {children}
  </Text>
);

export const Caption: React.FC = ({ children }) => (
  <Text
    fontFamily="PlusJakartaSans-Medium"
    fontSize={12}
    fontWeight="medium"
    lineHeight={16}
  >
    {children}
  </Text>
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
