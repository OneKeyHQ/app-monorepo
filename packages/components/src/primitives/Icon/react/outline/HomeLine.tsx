import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 17H7v-2h10z" />
    <Path
      fillRule="evenodd"
      d="m20.63 8.224.37.3V21H3V8.524l.37-.3L12 1.212zM5 9.476V19h14V9.476l-7-5.688z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeLine;
