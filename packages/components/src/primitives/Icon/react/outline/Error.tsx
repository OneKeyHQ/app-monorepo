import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 17h-2v-2.01h2zm0-3h-2V9h2z" />
    <Path
      fillRule="evenodd"
      d="M23.257 20H.743L12 1.041zm-19-2h15.486L12 4.958z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgError;
