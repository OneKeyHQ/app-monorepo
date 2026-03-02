import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeRoof = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22.895 9.57-1.164 1.626L20 9.956V21H4V9.956l-1.731 1.24L1.104 9.57 12 1.77zM6 8.524V19h12V8.524L12 4.23z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeRoof;
