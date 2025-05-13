import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBug = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17 7.17V7A5 5 0 0 0 7 7v.17c-.405.144-.77.372-1.074.663L3.564 7.05a1 1 0 1 0-.628 1.898l2.085.691A3 3 0 0 0 5 10v2H3a1 1 0 1 0 0 2h2v1q.001.645.113 1.259l-2.205.801a1 1 0 1 0 .684 1.88l2.158-.785A7 7 0 0 0 11 21.93V13a1 1 0 1 1 2 0v8.93a7 7 0 0 0 5.25-3.775l2.158.785a1 1 0 1 0 .684-1.88l-2.205-.801q.112-.614.113-1.259v-1h2a1 1 0 1 0 0-2h-2v-2q0-.207-.027-.407l2.071-.637a1 1 0 0 0-.588-1.912l-2.427.747A3 3 0 0 0 17 7.17M12 4a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBug;
