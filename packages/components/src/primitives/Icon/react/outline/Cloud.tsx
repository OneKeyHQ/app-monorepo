import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4a7 7 0 0 1 6.939 6.089A5 5 0 0 1 18 20H7A6 6 0 0 1 5.598 8.165 7 7 0 0 1 12 4m0 2a5 5 0 0 0-4.729 3.371l-.2.583-.612.082A4.001 4.001 0 0 0 7 18h11a3 3 0 0 0 0-6h-1v-1a5 5 0 0 0-5-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloud;
