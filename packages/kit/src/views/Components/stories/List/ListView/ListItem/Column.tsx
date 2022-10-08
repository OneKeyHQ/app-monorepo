/* eslint-disable no-nested-ternary */
import { ComponentProps, FC, ReactNode, isValidElement } from 'react';

import { Icon, Image, Text, VStack } from '@onekeyhq/components';

interface ColumnProps extends ComponentProps<typeof VStack> {
  text?: {
    size?: 'lg' | 'sm';
    label?: string | ReactNode;
    description?: string | ReactNode;
    labelProps?: ComponentProps<typeof Text>;
    descriptionProps?: ComponentProps<typeof Text>;
  };
  image?: ComponentProps<typeof Image>;
  icon?: ComponentProps<typeof Icon>;
}

const Column: FC<ColumnProps> = ({ text, image, icon, children, ...rest }) => {
  // Text column
  if (text)
    return (
      <VStack space={1} {...rest}>
        {text.label ? (
          isValidElement(text.label) ? (
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
          isValidElement(text.description) ? (
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

export default Column;
