import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraGopro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 15h11v6H2V4h9zm-6 3h4v-2H5z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 13h-9V4h9zm-4.5-5.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraGopro;
