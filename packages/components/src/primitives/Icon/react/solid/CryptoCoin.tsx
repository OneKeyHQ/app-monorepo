import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptoCoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 5.611a4.502 4.502 0 0 0 0 8.778V18h2v-1.611a4.5 4.5 0 0 0 2.856-2.069l-1.712-1.032a2.5 2.5 0 1 1 0-2.576l1.712-1.032A4.5 4.5 0 0 0 13 7.61V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCryptoCoin;
