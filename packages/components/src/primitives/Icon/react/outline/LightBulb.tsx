import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 21h4m1.608-6a7 7 0 1 0-7.215 0m7.215 0q-.296.177-.608.326V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.674A7 7 0 0 1 8.392 15m7.216 0H8.392"
    />
  </Svg>
);
export default SvgLightBulb;
