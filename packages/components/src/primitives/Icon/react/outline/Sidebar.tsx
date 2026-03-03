import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSidebar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 14a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 7 14m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m0-4a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m0-4A1.25 1.25 0 1 1 7 10a1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h6V6H4zm8 0h8V6h-8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSidebar;
