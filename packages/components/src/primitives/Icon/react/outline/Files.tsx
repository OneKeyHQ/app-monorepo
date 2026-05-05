import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFiles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 7.586V19h-3v3H4V5h3V2h8.414zM6 20h10v-1H7V7H6zm3-3h10V9h-5V4H9zm7-10h1.586L16 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFiles;
