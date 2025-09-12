import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAurora = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      stroke="#8C8CA1"
      strokeWidth={0.7}
      d="m6.707 4.323-2.76 5.493A1.3 1.3 0 0 0 5.108 11.7h5.493a1.3 1.3 0 0 0 1.164-1.879L9.033 4.328c-.477-.96-1.845-.962-2.326-.005Z"
    />
  </Svg>
);
export default SvgAurora;
