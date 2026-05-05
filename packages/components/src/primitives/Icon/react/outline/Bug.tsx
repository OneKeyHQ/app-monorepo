import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBug = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a5 5 0 0 1 5 5h2v.571l1.408-.51.94-.342.683 1.879L19 9.7V12h3v2h-3v1c0 .43-.042.85-.116 1.258l3.147 1.144-.683 1.88-3.1-1.129a6.997 6.997 0 0 1-12.497 0l-3.099 1.128-.683-1.879 3.146-1.144A7 7 0 0 1 5 15v-1H2v-2h3V9.7L1.969 8.598l.683-1.88.94.343L5 7.57V7h2a5 5 0 0 1 5-5M7 15a5 5 0 0 0 4 4.9V12h2v7.9a5 5 0 0 0 4-4.9V9H7zm5-11a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBug;
