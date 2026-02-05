import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOffMute = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.293 3.293a1 1 0 1 1 1.414 1.414l-16 16a1 1 0 1 1-1.414-1.414l2.616-2.616A2 2 0 0 1 5 15V9a2 2 0 0 1 2-2h2.698l5.748-3.832A1 1 0 0 1 17 4v1.586zm-8.486 5.371A2 2 0 0 1 9.697 9H7v6h.586L15 7.586V5.868z"
      clipRule="evenodd"
    />
    <Path d="M17 20a1 1 0 0 1-1.555.832l-4.82-3.214 1.441-1.442L15 18.132v-4.889l2-2z" />
  </Svg>
);
export default SvgVolumeOffMute;
