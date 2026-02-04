import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRuler = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.484 2.391c.75-.75 1.968-.75 2.718 0l4.406 4.407c.75.75.75 1.967 0 2.717L9.515 21.61c-.75.75-1.967.75-2.718 0l-4.406-4.407a1.92 1.92 0 0 1 0-2.717l2.004-2.005 1.88 1.881a.961.961 0 0 0 1.36-1.359l-1.88-1.88 2.003-2.005L10.6 11.96a.96.96 0 1 0 1.359-1.36L9.117 7.76l2.004-2.005 1.88 1.88a.96.96 0 0 0 1.36-1.358l-1.88-1.88z" />
  </Svg>
);
export default SvgRuler;
