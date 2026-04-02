import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunrise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 21H6v-2h12zm4-4H2v-2h20zM5 13H2v-2h3zm7-6a5 5 0 0 1 5 5v1H7v-1a5 5 0 0 1 5-5m10 6h-3v-2h3zM7.758 6.343 6.344 7.758 4.223 5.636l1.414-1.414 2.12 2.12Zm12.019-.707-2.12 2.122-1.415-1.415 2.121-2.121zM13 5h-2V2h2z" />
  </Svg>
);
export default SvgSunrise;
