import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCopy3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 17h-4v4H3V7h4V3h14zM5 19h10V9H5zM9 7h8v8h2V5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCopy3;
