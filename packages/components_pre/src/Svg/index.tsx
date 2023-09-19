import RNSvg, { Path as RNPath } from 'react-native-svg';

import type { PathProps, SvgProps } from 'react-native-svg';

export type { SvgProps, PathProps };

function replaceProp(
  props: Record<string, any>,
  oldKey: string,
  newKey: string,
) {
  if (props[oldKey] !== undefined) {
    props[newKey] = props[oldKey];
    delete props[oldKey];
  }
}

function propsClean(props: Record<string, any>) {
  const propsModified = { ...props };
  replaceProp(propsModified, 'fill-rule', 'fillRule');
  replaceProp(propsModified, 'clip-rule', 'clipRule');
  return propsModified;
}

export function Svg(props: SvgProps) {
  return <RNSvg {...propsClean(props)} />;
}
export function Path(props: PathProps) {
  return <RNPath {...propsClean(props)} />;
}
