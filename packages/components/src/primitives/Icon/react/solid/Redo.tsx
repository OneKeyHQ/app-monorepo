import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRedo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.793 4.293a1 1 0 0 1 1.414 0L21.5 7.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L19.086 10H7a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3h5a1 1 0 1 1 0 2H7a5 5 0 0 1-5-5v-1a5 5 0 0 1 5-5h12.086l-2.293-2.293a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRedo;
