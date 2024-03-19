import { usePropsAndStyle } from 'tamagui';

import type { IVideoProps } from './type';

export function Video(rawProps: IVideoProps) {
  const [{ source, repeat, ...props }, style] = usePropsAndStyle(rawProps);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      autoPlay
      style={style as any}
      {...(props as any)}
      src={source}
      loop={repeat}
    />
  );
}

export type * from './type';
