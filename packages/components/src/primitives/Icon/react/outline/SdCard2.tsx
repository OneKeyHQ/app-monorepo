import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSdCard2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.828a3 3 0 0 1 .879-2.121l2.828-2.828A3 3 0 0 1 9.828 2zM9.828 4a1 1 0 0 0-.707.293L6.293 7.121A1 1 0 0 0 6 7.828V20h12V4h-2v3a1 1 0 1 1-2 0V4h-2v3a1 1 0 1 1-2 0V4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSdCard2;
