import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStreaming = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zm-10-5c-3 0-4.5 2-4.5 3h9c0-1-1.5-3-4.5-3m0-6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M17.75 7a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStreaming;
