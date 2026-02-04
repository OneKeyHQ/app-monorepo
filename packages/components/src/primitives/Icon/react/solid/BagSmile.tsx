import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBagSmile = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.943 4.875A2 2 0 0 1 5.94 3h12.12a2 2 0 0 1 1.997 1.875l.875 14A2 2 0 0 1 18.936 21H5.065a2 2 0 0 1-1.997-2.125zM10 8a1 1 0 0 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBagSmile;
