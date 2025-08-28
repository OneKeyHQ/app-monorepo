import { styled } from '@tamagui/core';
import { createStyledContext, withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Icon, SizableText, XStack } from '../../primitives';

import type { IXStackProps } from '../../primitives';

export type IBreadcrumbItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type IBreadcrumbSize = 'sm' | 'md' | 'lg';

const BreadcrumbContext = createStyledContext<{
  breadcrumbSize: IBreadcrumbSize;
}>({
  breadcrumbSize: 'md',
});

const BreadcrumbFrame = styled(XStack, {
  name: 'BreadcrumbFrame',
  context: BreadcrumbContext,
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '$1',
  variants: {
    breadcrumbSize: {
      sm: {
        gap: '$0.5',
      },
      md: {
        gap: '$1',
      },
      lg: {
        gap: '$1.5',
      },
    },
  } as const,
});

const BreadcrumbItem = styled(XStack, {
  name: 'BreadcrumbItem',
  context: BreadcrumbContext,
  alignItems: 'center',
  gap: '$1',
  cursor: 'pointer',
  userSelect: 'none',
  borderRadius: '$1',
  paddingHorizontal: '$1',
  paddingVertical: '$0.5',
  variants: {
    breadcrumbSize: {
      sm: {
        paddingHorizontal: '$0.5',
        paddingVertical: '$0.25',
      },
      md: {
        paddingHorizontal: '$1',
        paddingVertical: '$0.5',
      },
      lg: {
        paddingHorizontal: '$1.5',
        paddingVertical: '$0.75',
      },
    },
  } as const,
  pressStyle: {
    bg: '$bgHover',
  },
  hoverStyle: {
    bg: '$bgHover',
  },
});

const BreadcrumbText = styled(SizableText, {
  name: 'BreadcrumbText',
  allowFontScaling: false,
  context: BreadcrumbContext,
  color: '$textSubdued',
  variants: {
    breadcrumbSize: {
      sm: {
        size: '$bodySm',
      },
      md: {
        size: '$bodyMd',
      },
      lg: {
        size: '$bodyLg',
      },
    },
  } as const,
});

const BreadcrumbSeparator = ({
  separator,
  breadcrumbSize = 'md',
  ...props
}: {
  separator?: React.ReactNode;
  breadcrumbSize?: IBreadcrumbSize;
} & IXStackProps) => {
  const sizeMap = {
    sm: { minWidth: 12, minHeight: 12 },
    md: { minWidth: 14, minHeight: 14 },
    lg: { minWidth: 16, minHeight: 16 },
  };

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      {...sizeMap[breadcrumbSize]}
      {...props}
    >
      {typeof separator === 'string' ? (
        <BreadcrumbText breadcrumbSize={breadcrumbSize}>
          {separator}
        </BreadcrumbText>
      ) : (
        separator || (
          <Icon
            name="ChevronRightSmallOutline"
            size="$3.5"
            color="$iconDisabled"
          />
        )
      )}
    </XStack>
  );
};

const BreadcrumbLinkText = styled(SizableText, {
  name: 'BreadcrumbLinkText',
  allowFontScaling: false,
  context: BreadcrumbContext,
  color: '$textDefault',
  variants: {
    breadcrumbSize: {
      sm: {
        size: '$bodySm',
      },
      md: {
        size: '$bodyMd',
      },
      lg: {
        size: '$bodyLg',
      },
    },
  } as const,
});

export type IBreadcrumbProps = IXStackProps & {
  items: IBreadcrumbItem[];
  breadcrumbSize?: IBreadcrumbSize;
  separator?: React.ReactNode;
  maxItems?: number;
  showOverflowIndicator?: boolean;
  itemRender?: (item: IBreadcrumbItem, index: number) => React.ReactNode;
};

const BreadcrumbComponent = BreadcrumbFrame.styleable<
  IBreadcrumbProps,
  any,
  any
>((props: IBreadcrumbProps, ref: any) => {
  const {
    items,
    breadcrumbSize = 'md',
    maxItems,
    showOverflowIndicator = true,
    itemRender,
    ...rest
  } = props;

  const displayItems =
    maxItems && items.length > maxItems
      ? [
          ...items.slice(0, 1),
          ...(showOverflowIndicator
            ? [{ label: '...', href: undefined, onClick: undefined }]
            : []),
          ...items.slice(-(maxItems - 2)),
        ]
      : items;

  const handleItemPress = (item: IBreadcrumbItem) => {
    if (item.onClick) {
      item.onClick();
    }
  };

  const renderItem = (item: IBreadcrumbItem, index: number) => {
    if (itemRender) {
      return itemRender(item, index);
    }

    return (
      <BreadcrumbItem
        breadcrumbSize={breadcrumbSize}
        role={
          !platformEnv.isNative && (item.onClick || item.href)
            ? 'button'
            : undefined
        }
        onPress={() => handleItemPress(item)}
        disabled={!item.onClick ? !item.href : undefined}
      >
        {item.label === '...' ? (
          <BreadcrumbText breadcrumbSize={breadcrumbSize}>
            {item.label}
          </BreadcrumbText>
        ) : (
          <BreadcrumbLinkText breadcrumbSize={breadcrumbSize}>
            {item.label}
          </BreadcrumbLinkText>
        )}
      </BreadcrumbItem>
    );
  };

  return (
    <BreadcrumbFrame
      ref={ref}
      breadcrumbSize={breadcrumbSize}
      role={!platformEnv.isNative ? 'navigation' : undefined}
      aria-label="Breadcrumb"
      {...rest}
    >
      {displayItems.map((item, index) => (
        <XStack key={index} alignItems="center">
          {renderItem(item, index)}
          {index < displayItems.length - 1 ? (
            <BreadcrumbSeparator breadcrumbSize={breadcrumbSize} />
          ) : null}
        </XStack>
      ))}
    </BreadcrumbFrame>
  );
});

export const Breadcrumb = withStaticProperties(BreadcrumbComponent, {
  props: BreadcrumbContext.Provider,
  Item: BreadcrumbItem,
  Text: BreadcrumbText,
  LinkText: BreadcrumbLinkText,
  Separator: BreadcrumbSeparator,
});
