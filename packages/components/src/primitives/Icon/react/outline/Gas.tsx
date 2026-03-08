import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGas = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 11H6V9h6z" />
    <Path
      fillRule="evenodd"
      d="M15 9h4v7h1V8.414L17.586 6 19 4.586l3 3V18h-5v-7h-2v8h1v2H2v-2h1V3h12zM5 19h8V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGas;
