import type { ComponentProps, ReactElement } from 'react';
import { cloneElement } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

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
};

function ContainerBox(props: IProps) {
  const { title, titleProps, contentProps, blockProps, children } = props;
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
      <Stack
        borderWidth={1}
        borderRadius={12}
        borderColor="$border"
        bg="$bgSubdued"
        overflow="hidden"
        px="$5"
        {...contentProps}
      >
        {children &&
          (children instanceof Array ? children : [children]).map(
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
