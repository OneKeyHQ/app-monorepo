import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m14 6.499 4.958-1.328 3.882 14.488-5.796 1.554L14 9.85V21H2V5h4V3h8zM4 19h2V7H4zm4-2v2h4v-2zm7.611-8.863 2.847 10.625 1.932-.518L17.543 7.62l-1.932.518ZM8 15h4V9H8zm0-8h4V5H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;
