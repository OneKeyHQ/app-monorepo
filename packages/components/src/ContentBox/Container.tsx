import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import Box from '../Box';

interface IContentItemProps {
  hasDivider?: boolean;
  children?: React.ReactElement<any> | null;
}
export type ContentItemBaseProps = IContentItemProps;

interface IContainerProps extends IBoxProps<IContainerProps> {
  children:
    | (React.ReactElement<ContentItemBaseProps> | boolean)[]
    | React.ReactElement<ContentItemBaseProps>
    | boolean
    | null;
}
export type ContainerProps = IContainerProps;

const Container: FC<ContainerProps> = ({ children, ...props }) => (
  <Box
    w="100%"
    shadow="depth.2"
    flexDirection="column"
    bg="surface-default"
    borderRadius="12px"
    overflow="hidden"
    {...props}
  >
    {children &&
      (children instanceof Array ? children : [children]).map(
        (child, index) => {
          if (child === true || child === false || child === null) return;
          const { children: childChildren } = child.props;
          return React.cloneElement(child, {
            ...child.props,
            key: index.toString(),
            hasDivider:
              index !==
              (children instanceof Array ? children : [children]).length - 1,
            children: childChildren,
          });
        },
      )}
  </Box>
);

export default Container;
