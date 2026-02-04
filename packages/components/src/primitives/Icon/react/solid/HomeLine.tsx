import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.741 1.774a1.996 1.996 0 0 1 2.518 0l6.986 5.676c.467.38.737.948.737 1.55v10.004A1.996 1.996 0 0 1 18.986 21H5.014a1.996 1.996 0 0 1-1.996-1.996V8.999c0-.6.27-1.17.737-1.549zM8.008 15.012a.998.998 0 1 0 0 1.996h7.984a.998.998 0 1 0 0-1.996z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeLine;
