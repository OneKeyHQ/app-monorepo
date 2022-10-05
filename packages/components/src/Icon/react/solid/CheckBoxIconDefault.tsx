import Svg, { SvgProps, Rect } from 'react-native-svg';

const SvgCheckBoxIconDefault = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" {...props}>
    <Rect x={4} y={7} width={8} height={2} rx={1} fill="currentColor" />
  </Svg>
);

export default SvgCheckBoxIconDefault;
