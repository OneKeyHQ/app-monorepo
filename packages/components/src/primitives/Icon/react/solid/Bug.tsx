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
      d="M12 2a5 5 0 0 1 5 5h2v.572l2.349-.853.683 1.879L19 9.7V12h3v2h-3v1q0 .645-.112 1.259l3.144 1.143-.683 1.88-3.098-1.127A7.01 7.01 0 0 1 13 21.93V12h-2v9.929a7 7 0 0 1-5.25-3.774l-3.098 1.126-.683-1.879 3.144-1.143A7 7 0 0 1 5 15v-1H2v-2h3V9.7L1.969 8.598l.683-1.88L5 7.573V7h2a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBug;
