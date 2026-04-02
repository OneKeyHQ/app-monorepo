import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraGopro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 6H4v13h16v-3h2v5H2V4h8z" />
    <Path d="M10 17H6v-2h4zm7-9.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M22 14H12V4h10zm-8-2h6V6h-6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraGopro;
