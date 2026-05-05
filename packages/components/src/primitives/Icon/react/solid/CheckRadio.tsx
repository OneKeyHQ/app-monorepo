import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckRadio = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1.574 11.512L8.5 11.586 7.086 13l3.488 3.488 5.833-7.129-1.548-1.266z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckRadio;
