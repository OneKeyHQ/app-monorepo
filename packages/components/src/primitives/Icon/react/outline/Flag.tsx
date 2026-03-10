import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m17.201 9 4.667 7H6v6H4V2h17.868zM6 14h12.132l-3.334-5 3.334-5H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFlag;
