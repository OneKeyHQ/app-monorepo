import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHead = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 2c3.162 0 6.221 1.535 7.486 4.769.528 1.348 1.17 2.263 1.974 3.41.271.387.561.8.872 1.266l.582.873L19 14.066V19h-4v3H6v-1l.001-.474c.005-2.345.009-3.925-1.299-5.592A8 8 0 0 1 11 2" />
  </Svg>
);
export default SvgHead;
