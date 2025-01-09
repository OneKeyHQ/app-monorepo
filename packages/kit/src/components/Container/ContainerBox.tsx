import type { ComponentProps, ReactElement } from 'react';
import { cloneElement } from 'react';

import { StyleSheet } from 'react-native';

import { Group, SizableText, Stack } from '@onekeyhq/components';

interface IContentItemProps {
  hasDivider?: boolean;
  children?: ReactElement<any> | null;
}
export type IContentItemBaseProps = IContentItemProps;

type IProps = {
  title?: React.ReactNode;
  titleProps?: ComponentProps<typeof SizableText>;
  contentProps?: ComponentProps<typeof Stack>;
  blockProps?: ComponentProps<typeof Stack>;
  children:
    | (ReactElement<IContentItemBaseProps> | boolean | null | undefined)[]
    | ReactElement<IContentItemBaseProps>
    | boolean
    | null
    | undefined;
  hasDivider?: boolean;
};

function ContainerBox(props: IProps) {
  const { title, titleProps, contentProps, blockProps, children, hasDivider } =
    props;
  return (
    <Stack {...blockProps}>
      {typeof title === 'string' ? (
        <SizableText
          px="$4"
          size="$headingSm"
          color="$textSubdued"
          {...titleProps}
        >
          {title}
        </SizableText>
      ) : (
        title
      )}
      <Group
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius={12}
        {...contentProps}
      >
        {children
          ? (children instanceof Array ? children : [children]).map(
              (child, index) => {
                if (
                  child === true ||
                  child === false ||
                  child === null ||
                  child === undefined
                )
                  return;
                const { children: childChildren } = child.props;
                return cloneElement(child, {
                  ...child.props,
                  key: index.toString(),
                  hasDivider: hasDivider
                    ? index !==
                      (children instanceof Array ? children : [children])
                        .length -
                        1
                    : hasDivider,

                  children: childChildren,
                });
              },
            )
          : null}
      </Group>
    </Stack>
  );
}

export { ContainerBox };
