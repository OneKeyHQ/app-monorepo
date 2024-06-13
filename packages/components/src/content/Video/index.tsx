import { usePropsAndStyle } from 'tamagui';

import type { IVideoProps } from './type';

export function Video(rawProps: IVideoProps) {
  const [{ source, repeat, resizeMode, ...props }, style] =
    usePropsAndStyle(rawProps);
  if (resizeMode) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (style as any)['object-fit'] = resizeMode;
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      autoPlay
      style={style as any}
      {...(props as any)}
      src={typeof source === 'string' ? source : source?.uri}
      loop={repeat}
    />
  );
}

export type * from './type';
export * from './enum';
