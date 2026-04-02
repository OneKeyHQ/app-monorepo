import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSearchMenu = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.004 5a7 7 0 0 1 5.604 11.194L23.414 19 22 20.414l-2.807-2.806A7 7 0 1 1 15.003 5ZM15 7a5 5 0 0 0-5 5h2a3 3 0 0 1 3-3z"
      clipRule="evenodd"
    />
    <Path d="M7.004 16v2h-5v-2zm-1-3h-4v-2h4zm1-5h-5V6h5z" />
  </Svg>
);
export default SvgSearchMenu;
