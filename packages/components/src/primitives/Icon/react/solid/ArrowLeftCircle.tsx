import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowLeftCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M6.586 12 11 16.414 12.414 15l-2-2H17v-2h-6.586l2-2L11 7.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowLeftCircle;
