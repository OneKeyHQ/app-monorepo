import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 11H8V9h3z" />
    <Path
      fillRule="evenodd"
      d="M17 11h5v6.5a3.5 3.5 0 0 1-3 3.465V21H5.5A3.5 3.5 0 0 1 2 17.5V3h15zm0 6.5a1.5 1.5 0 0 0 3 0V13h-3zM6 17h7v-2H6zM6 7v6h7V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNewspaper;
