import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import Box from '../Box';
import ContentItem, { ContentItemProps } from '../ContentItem';

interface IContainerProps extends IBoxProps<IContainerProps> {
  children: React.ReactElement<ContentItemProps>[] | null;
}
export type ContainerProps = IContainerProps;

const Container: FC<ContainerProps> = ({ children, ...props }) => (
  <Box
    w="100%"
    flexDirection="column"
    bg="surface-default"
    borderRadius="12px"
    {...props}
  >
    {children?.map((child, index) => {
      const {
        title: childTitle,
        value: childValue,
        describe: childDescribe,
        children: childChildren,
      } = child.props;

      return (
        <ContentItem
          title={childTitle}
          value={childValue}
          describe={childDescribe}
          hasDivider={index !== children.length - 1}
        >
          {childChildren}
        </ContentItem>
      );
    })}
  </Box>
);

export default Container;
