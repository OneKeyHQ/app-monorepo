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
      d="M15.004 5a7 7 0 0 1 5.604 11.194L23.414 19 22 20.414l-2.807-2.807A7 7 0 1 1 15.003 5Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10"
      clipRule="evenodd"
    />
    <Path d="M7.004 18h-5v-2h5zm-1-5h-4v-2h4zm1-5h-5V6h5z" />
  </Svg>
);
export default SvgSearchMenu;
