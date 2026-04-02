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
      d="M21 8.524V21H3V8.524l9-7.312zM7 17h10v-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeLine;
