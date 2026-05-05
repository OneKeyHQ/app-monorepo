import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSun = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 23h-2v-3h2zm-5.945-4.64L4.93 20.484 3.517 19.07l2.124-2.124zm13.429.71-1.414 1.414-2.124-2.124 1.414-1.414zM7.758 7.758a5.999 5.999 0 1 1 8.484 8.484 5.999 5.999 0 1 1-8.484-8.484M4 13H1v-2h3zm19 0h-3v-2h3zM7.055 5.64 5.64 7.055 3.517 4.93 4.93 3.516zm13.429-.71L18.36 7.055 16.946 5.64l2.124-2.124zM13 4h-2V1h2z" />
  </Svg>
);
export default SvgSun;
