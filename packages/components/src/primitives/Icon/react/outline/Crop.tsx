import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 5h12v12h3v2h-3v3h-2v-3H5V7H2V5h3V2h2zm0 12h10V7H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrop;
