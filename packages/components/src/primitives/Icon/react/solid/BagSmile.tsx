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
      d="M21.066 21H2.938L4.062 3h15.88zM8.002 8a4 4 0 0 0 8 0V7h-2v1a2 2 0 0 1-4 0V7h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBagSmile;
