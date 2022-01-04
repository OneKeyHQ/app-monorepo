import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import Box from '../Box';

interface IContentItemProps {
  hasDivider?: boolean;
  children?: React.ReactElement<any> | null;
}
export type ContentItemBaseProps = IContentItemProps;

interface IContainerProps extends IBoxProps<IContainerProps> {
  children: React.ReactElement<ContentItemBaseProps>[] | null;
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
    {children &&
      children.map((child, index) => {
        const { children: childChildren } = child.props;

        return React.cloneElement(child, {
          ...child.props,
          key: index.toString(),
          hasDivider: index !== children.length - 1,
          children: childChildren,
        });
      })}
  </Box>
);

export default Container;
