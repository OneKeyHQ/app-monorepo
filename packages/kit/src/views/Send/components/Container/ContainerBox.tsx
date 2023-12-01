import type { ComponentProps, ReactElement } from 'react';
import { cloneElement } from 'react';

import { Stack, Text } from '@onekeyhq/components';

interface IContentItemProps {
  hasDivider?: boolean;
  children?: ReactElement<any> | null;
}
export type IContentItemBaseProps = IContentItemProps;

type IProps = {
  title?: React.ReactNode;
  titleProps?: ComponentProps<typeof Text>;
  contentProps?: ComponentProps<typeof Stack>;
  blockProps?: ComponentProps<typeof Stack>;
  children:
    | (ReactElement<IContentItemBaseProps> | boolean)[]
    | ReactElement<IContentItemBaseProps>
    | boolean
    | null;
};

function ContainerBox(props: IProps) {
  const { title, titleProps, contentProps, blockProps, children } = props;
  return (
    <Stack {...blockProps}>
      {typeof title === 'string' ? (
        <Text py="$2" variant="$headingSm" color="$textSubdued" {...titleProps}>
          {title}
        </Text>
      ) : (
        title
      )}
      <Stack
        borderWidth={1}
        borderRadius={12}
        borderColor="$borderSubdued"
        overflow="hidden"
        {...contentProps}
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
                  (children instanceof Array ? children : [children]).length -
                    1,
                children: childChildren,
              });
            },
          )}
      </Stack>
    </Stack>
  );
}

export { ContainerBox };
