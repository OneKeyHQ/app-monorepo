import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderThree = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.951 20.004v-5.002h-.955a1 1 0 0 1 0-2h3.91a1 1 0 1 1 0 2h-.955v5.002a1 1 0 0 1-2 0m6.05 0v-7.003a1 1 0 0 1 2 0v7.003a1 1 0 0 1-2 0m6.048 0v-3.002h-.956a1 1 0 0 1 0-2h3.911a1 1 0 0 1 0 2h-.955v3.002a1 1 0 0 1-2 0m0-8.003V3.997a1 1 0 1 1 2 0v8.004a1 1 0 0 1-2 0m-12.098-2V3.996a1 1 0 0 1 2 0V10a1 1 0 1 1-2 0Zm6.05-6.004a1 1 0 0 1 2 0V8h.954a1 1 0 0 1 0 2h-3.91a1 1 0 1 1 0-2H11z" />
  </Svg>
);
export default SvgSliderThree;
