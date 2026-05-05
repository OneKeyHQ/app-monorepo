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
      d="M12 7.5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5m0 2a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
    <Path d="M17.75 7a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h3.18c.59-2.034 2.425-3.5 4.82-3.5s4.231 1.466 4.82 3.5H20V6H4zm8-1.5c-1.259 0-2.197.614-2.672 1.5h5.345c-.475-.886-1.414-1.5-2.673-1.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStreaming;
