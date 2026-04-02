import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 17h-7v-2h7z" />
    <Path
      fillRule="evenodd"
      d="M12 7a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20.5 21.5h-17v-19h17zm-15-2h13v-15h-13z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassport;
