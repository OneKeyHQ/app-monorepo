import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 5.126a4 4 0 0 1 0 7.748V21H6v-8.126a4 4 0 0 1 0-7.748V3h2zM7 7a2 2 0 1 0 0 4 2 2 0 1 0 0-4m11 6.126a4 4 0 1 1-2 0V3h2zM17 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSliderVer;
