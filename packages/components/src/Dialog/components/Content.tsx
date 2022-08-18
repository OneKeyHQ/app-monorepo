import React, { FC } from 'react';

import { Icon } from 'native-base';

import Box from '../../Box';
import Center from '../../Center';
import { Exclamation, InformationCircle } from '../../Icon/react/outline';
import { Text } from '../../Typography';

export type IconType = 'danger' | 'info';

export type ContentProps = {
  /**
   * 自定义展示内容
   */
  icon?: JSX.Element;
  /**
   * 默认类型的 Icon 展示
   */
  iconType?: IconType;
  /**
   * 标题
   */
  title?: string;
  /**
   * 内容
   */
  content?: string;
  contentElement?: JSX.Element;
  /**
   * Input
   */
  input?: JSX.Element;
};

const getIcon = (iconType: IconType) => {
  let icon = null;
  if (iconType === 'danger') {
    icon = Exclamation;
  }
  if (iconType === 'info') {
    icon = InformationCircle;
  }
  return (
    !!icon && (
      <Center
        p={3}
        mb={4}
        rounded="full"
        bgColor={
          // eslint-disable-next-line no-nested-ternary
          iconType === 'danger'
            ? 'surface-critical-default'
            : iconType === 'info'
            ? 'surface-neutral-default'
            : undefined
        }
      >
        <Icon
          as={icon}
          size={6}
          color={
            // eslint-disable-next-line no-nested-ternary
            iconType === 'danger'
              ? 'icon-critical'
              : iconType === 'info'
              ? 'icon-default'
              : undefined
          }
        />
      </Center>
    )
  );
};

const Content: FC<ContentProps> = ({
  icon,
  iconType,
  title,
  content,
  contentElement,
  input,
}) => (
  <Box flexDirection="column" w="100%" alignItems="center" mb={4}>
    {!!(icon || iconType) &&
      (iconType ? getIcon(iconType) : <Box mb={5}>{icon}</Box>)}
    {!!title && (
      <Text
        typography={{ sm: 'DisplayMedium', md: 'Heading' }}
        color="text-default"
        textAlign="center"
      >
        {title}
      </Text>
    )}

    {contentElement}

    {!!content && (
      <Text
        mt="2"
        typography={{ sm: 'Body1', md: 'Body2' }}
        color="text-subdued"
        textAlign="center"
      >
        {content}
      </Text>
    )}
    {input}
  </Box>
);

export default Content;
