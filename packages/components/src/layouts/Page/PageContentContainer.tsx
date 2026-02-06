import { Stack } from '../../primitives';

import type {
  IPageContentContainerLayout,
  IPageContentContainerProps,
} from './type';

function getMaxWidth(layout: IPageContentContainerLayout) {
  switch (layout) {
    case 'compact':
      return 520;
    case 'regular':
      return 1140;
    default:
      return undefined;
  }
}

export function PageContentContainer({
  children,
  layout = 'regular',
  padded = true,
  ...props
}: IPageContentContainerProps) {
  const maxWidth = getMaxWidth(layout);
  return (
    <Stack
      width="100%"
      {...(padded ? { px: '$pagePadding' } : undefined)}
      {...(maxWidth
        ? {
            $gtMd: {
              maxWidth,
              width: '100%',
              mx: 'auto',
            },
          }
        : undefined)}
      {...props}
    >
      {children}
    </Stack>
  );
}
