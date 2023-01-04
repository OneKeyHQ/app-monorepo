import type { FC, ReactElement } from 'react';
import { cloneElement } from 'react';

import Box from '../Box';

import type { IBoxProps } from 'native-base';

interface IContentItemProps {
  hasDivider?: boolean;
  children?: ReactElement<any> | null;
}
export type ContentItemBaseProps = IContentItemProps;

interface IContainerProps extends IBoxProps<IContainerProps> {
  children:
    | (ReactElement<ContentItemBaseProps> | boolean)[]
    | ReactElement<ContentItemBaseProps>
    | boolean
    | null;
}
export type ContainerProps = IContainerProps;

const Container: FC<ContainerProps> = ({ children, ...props }) => (
  <Box
    w="100%"
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
          return cloneElement(child, {
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
