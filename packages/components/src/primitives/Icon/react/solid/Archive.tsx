import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchive = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 5v7h4a3 3 0 0 0 6 .012V12h4V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchive;
