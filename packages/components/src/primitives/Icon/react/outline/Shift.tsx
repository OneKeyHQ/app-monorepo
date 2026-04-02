import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.83 14H18v7H6v-7H.17L12 1.548zm-19-2H8v7h8v-7h3.17L12 4.451z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShift;
