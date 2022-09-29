/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC, ReactNode } from 'react';

import { Icon, Image, Text, VStack } from '@onekeyhq/components';

type ColumnProps = {
  text?: {
    size?: 'lg' | 'sm';
    label?: string | ReactNode;
    description?: string | ReactNode;
    labelProps?: ComponentProps<typeof Text>;
    descriptionProps?: ComponentProps<typeof Text>;
  };
  image?: ComponentProps<typeof Image>;
  icon?: ComponentProps<typeof Icon>;
} & ComponentProps<typeof VStack>;

const defaultProps = {} as const;

const Column: FC<ColumnProps> = ({ text, image, icon, children, ...rest }) => {
  // Text column
  if (text)
    return (
      <VStack space={1} {...rest}>
        {text.label ? (
          React.isValidElement(text.label) ? (
            text.label
          ) : (
            <Text
              typography={text.size === 'sm' ? 'Body2Strong' : 'Body1Strong'}
              {...text.labelProps}
            >
              {text.label}
            </Text>
          )
        ) : null}
        {text.description ? (
          React.isValidElement(text.description) ? (
            text.description
          ) : (
            <Text
              typography="Body2"
              color="text-subdued"
              {...text.descriptionProps}
            >
              {text.description}
            </Text>
          )
        ) : null}
      </VStack>
    );

  if (image) return <Image size={10} {...image} />;
  if (icon) return <Icon {...icon} />;

  // Custom column
  return <>{children}</>;
};

Column.defaultProps = defaultProps;

export default Column;
