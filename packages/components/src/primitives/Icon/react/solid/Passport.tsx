import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M20.5 2.5v19h-17v-19zM8.5 15v2h7v-2zM12 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassport;
