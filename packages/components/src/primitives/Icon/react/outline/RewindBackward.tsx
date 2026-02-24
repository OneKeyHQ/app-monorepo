import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRewindBackward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m20 20-8-6.001V20L1.333 12 12 4v6l8-6zM4.666 12 10 16V7.999zm8 0L18 16V7.999z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRewindBackward;
