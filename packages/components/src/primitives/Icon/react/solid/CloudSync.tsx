import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudSync = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4a7 7 0 0 1 6.941 6.089A5.001 5.001 0 0 1 18 20H7A6 6 0 0 1 5.599 8.165 7 7 0 0 1 12 4m0 5.25a3.5 3.5 0 1 0 3.5 3.5h-2a1.5 1.5 0 1 1-1.5-1.5v1.5l3-2.5-3-2.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudSync;
