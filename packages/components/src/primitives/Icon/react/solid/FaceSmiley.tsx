import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceSmiley = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M4.5 12a7.5 7.5 0 0 0 15 0h-2a5.5 5.5 0 1 1-11 0zm5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceSmiley;
