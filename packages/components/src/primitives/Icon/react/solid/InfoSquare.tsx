import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInfoSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-11 7v2h1v5h2v-7zm1-1h2V7h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInfoSquare;
