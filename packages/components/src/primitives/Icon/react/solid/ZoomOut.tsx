import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZoomOut = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 3a8 8 0 0 1 6.32 12.905L21.414 20 20 21.414l-4.095-4.094A8 8 0 1 1 11 3m-4 7v2h8v-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZoomOut;
