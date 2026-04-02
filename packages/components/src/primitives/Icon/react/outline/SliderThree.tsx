import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderThree = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.906 15.002H6.951v6.003h-2v-6.003H2.996v-2h5.91zM13 21.004h-2V12h2v9.003Zm8.004-4.002h-1.955v4.002h-2v-4.002h-1.955v-2h5.91zm-1.955-4.001h-2V2.997h2zM6.951 11h-2V2.997h2zM13 7.999h1.955v2h-5.91v-2H11V2.997h2V8Z" />
  </Svg>
);
export default SvgSliderThree;
