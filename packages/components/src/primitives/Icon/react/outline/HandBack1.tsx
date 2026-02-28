import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandBack1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.001 13.83a8.171 8.171 0 0 1-15.284 4.018l-.004.003-3.402-6.464.408-.512.75-.938A3 3 0 0 1 7 9.06V6a3 3 0 0 1 4.473-2.612 2.996 2.996 0 0 1 5.42.825A3 3 0 0 1 21 7v6.83ZM11 6a1 1 0 1 0-2 0v7.081l-2.563-2.05a1 1 0 0 0-1.406.155l-.342.427 2.431 4.618.25.472A6.171 6.171 0 0 0 19 13.83V7a1 1 0 0 0-2 0v5h-2V5a1 1 0 0 0-2 0v6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHandBack1;
