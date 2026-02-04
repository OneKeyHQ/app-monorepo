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
      d="M7 7a5 5 0 0 1 10 0c.625 0 1.183.287 1.55.736l1.858-.676a1 1 0 1 1 .684 1.88L19 9.7V12h2a1 1 0 1 1 0 2h-2v1q-.001.645-.113 1.259l2.205.801a1 1 0 1 1-.684 1.88l-2.158-.785A7 7 0 0 1 13 21.93V13a1 1 0 1 0-2 0v8.93a7 7 0 0 1-5.25-3.775l-2.158.785a1 1 0 0 1-.684-1.88l2.205-.801A7 7 0 0 1 5 15v-1H3a1 1 0 1 1 0-2h2V9.7l-2.092-.76a1 1 0 1 1 .684-1.88l1.858.676C5.817 7.286 6.375 7 7 7m5-3a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBug;
