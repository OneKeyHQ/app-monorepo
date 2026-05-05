import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTypeC = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 13H5v-2h14z" />
    <Path
      fillRule="evenodd"
      d="M18 6a6 6 0 0 1 0 12H6A6 6 0 0 1 6 6zM6 8a4 4 0 1 0 0 8h12a4 4 0 0 0 0-8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTypeC;
