import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 21 21 22.414l-2.44-2.44-.243.016A5 5 0 0 1 18 20H7A6 6 0 0 1 5.602 8.164q.173-.392.391-.757L1.586 3 3 1.586zM7.47 8.884q-.112.237-.199.487l-.2.583-.612.082A4.001 4.001 0 0 0 7 18h9.586z"
      clipRule="evenodd"
    />
    <Path d="M12 4a7 7 0 0 1 6.939 6.089 5 5 0 0 1 3.844 6.373l-.292.956-1.913-.584.292-.956A3 3 0 0 0 18 12h-1v-1a5 5 0 0 0-6.018-4.896l-.978.202-.404-1.96.978-.201A7 7 0 0 1 12 4" />
  </Svg>
);
export default SvgCloudOff;
