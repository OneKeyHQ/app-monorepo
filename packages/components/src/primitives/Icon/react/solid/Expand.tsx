import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgExpand = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.2 12.45a1.8 1.8 0 0 1 1.8 1.8v4.5a1.8 1.8 0 0 1-1.8 1.8H4.8a1.8 1.8 0 0 1-1.8-1.8v-4.5a1.8 1.8 0 0 1 1.8-1.8z" />
    <Path d="M19.2 3.45a1.8 1.8 0 0 1 1.8 1.8v8.1a1.8 1.8 0 0 1-1.8 1.8h-4.5a.9.9 0 0 1 0-1.8h4.5v-8.1H5.7v4.5a.9.9 0 1 1-1.8 0v-4.5a1.8 1.8 0 0 1 1.8-1.8z" />
    <Path d="M16.5 7.05a.9.9 0 0 1 .9.9v2.7a.9.9 0 0 1-1.8 0v-.527l-1.164 1.163a.9.9 0 1 1-1.272-1.272l1.163-1.164H13.8a.9.9 0 1 1 0-1.8z" />
  </Svg>
);
export default SvgExpand;
