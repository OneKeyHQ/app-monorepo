import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 18V8a1 1 0 0 1 2 0v10h15a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2m5-4v-1a6 6 0 0 1 6-6h4.586l-1.793-1.793a1 1 0 1 1 1.414-1.414l3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 1 1-1.414-1.414L17.586 9H13a4 4 0 0 0-4 4v1a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgShare;
