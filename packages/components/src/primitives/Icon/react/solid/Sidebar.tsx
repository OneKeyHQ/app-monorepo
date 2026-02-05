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
      d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 2h6v12H4z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M7 10a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 7 10m0 3.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5m0 3.25A1.25 1.25 0 1 1 7 14a1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M7 10a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 7 10m0 3.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5m0 3.25A1.25 1.25 0 1 1 7 14a1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSidebar;
