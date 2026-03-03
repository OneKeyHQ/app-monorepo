import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m16 8.382 6-3v13.236l-6-3V20H2V4h14zm0 2.236v2.764l4 2V8.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCamera;
