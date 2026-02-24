import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-4.414 9L9 12.414l2-2V17h2v-6.586l2 2L16.414 11 12 6.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTopCircle;
