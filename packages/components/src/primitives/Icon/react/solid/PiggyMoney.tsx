import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiggyMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.5 3c1.743 0 2.955.588 3.74 1.223.338.273.59.548.769.777H14a7 7 0 0 1 6.72 8.96 1 1 0 0 0 1.146-1.46l-.5-.865 1.73-1.001.5.865a3 3 0 0 1-3.714 4.286A7 7 0 0 1 19 16.89V21h-6v-2h-2v2H5v-3.45A5.8 5.8 0 0 1 3.448 16H1V8.935h2.324c.286-.649.657-1.291 1.176-1.851V3zm2.75 6.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiggyMoney;
