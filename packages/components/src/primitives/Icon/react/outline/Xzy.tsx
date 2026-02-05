import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXzy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.37 3.224a1 1 0 0 1 1.337.069l3 3a1 1 0 1 1-1.414 1.414L10 6.414V14h10a1 1 0 1 1 0 2H9.414l-4.707 4.707a1 1 0 1 1-1.414-1.414L8 14.586V6.414L6.707 7.707a1 1 0 1 1-1.414-1.414l3-3z" />
  </Svg>
);
export default SvgXzy;
