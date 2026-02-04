import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudSync = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 8.39a.5.5 0 0 1 .839-.367l2.013 1.859a.5.5 0 0 1 0 .734l-2.013 1.859a.5.5 0 0 1-.839-.368v-.858a1.5 1.5 0 1 0 1.2 2.4 1 1 0 0 1 1.6 1.2 3.5 3.5 0 1 1-2.8-5.6z" />
    <Path
      fillRule="evenodd"
      d="M12 4a7 7 0 0 1 6.939 6.089A5 5 0 0 1 18 20H7A6 6 0 0 1 5.598 8.165 7 7 0 0 1 12 4m0 2a5 5 0 0 0-4.729 3.371 1 1 0 0 1-.812.665A4.001 4.001 0 0 0 7 18h11a3 3 0 0 0 0-6 1 1 0 0 1-1-1 5 5 0 0 0-5-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudSync;
