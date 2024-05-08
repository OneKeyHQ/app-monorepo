import {
  type ComponentProps,
  type FC,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { useDebouncedCallback } from 'use-debounce';

import { Image, Stack, useMedia } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

type IImageItem = {
  ratio: number;
  source: ComponentProps<typeof Image>['source'];
};

type IRatioImageProps = {
  sm: IImageItem;
  base: IImageItem;
};

export const RatioImage: FC<IRatioImageProps> = ({ sm, base }) => {
  const [width, setWidth] = useState<number>(0);
  const md = useMedia();
  const debouncedSetHeight = useDebouncedCallback(
    (value: number) => {
      setWidth(value);
    },
    100,
    {
      trailing: true,
    },
  );
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      debouncedSetHeight(e.nativeEvent.layout.width);
    },
    [debouncedSetHeight],
  );

  const memo = useMemo(
    () =>
      md.md
        ? { source: sm.source, height: Math.floor(width / sm.ratio) }
        : { source: base.source, height: Math.floor(width / base.ratio) },
    [sm, base, width, md],
  );
  return (
    <Stack onLayout={onLayout} height={memo.height}>
      {width ? <Image height={memo.height} source={memo.source} /> : null}
    </Stack>
  );
};
