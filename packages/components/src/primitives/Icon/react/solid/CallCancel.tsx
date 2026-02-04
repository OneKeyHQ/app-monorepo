import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallCancel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.707 4.707a1 1 0 0 0-1.414-1.414l-8.457 8.457a12 12 0 0 1-1.301-1.872l.748-.749a2 2 0 0 0 .502-1.988L9.97 4.425A2 2 0 0 0 8.055 3H4.999c-1.088 0-2.04.895-1.968 2.062a16.93 16.93 0 0 0 4.261 10.232l-3.999 3.999a1 1 0 1 0 1.414 1.414zm-1.77 16.26a16.9 16.9 0 0 1-8.649-3.012l3.616-3.616q.108.064.216.125l.75-.749a2 2 0 0 1 1.988-.501l2.715.814A2 2 0 0 1 21 15.944V19c0 1.088-.895 2.04-2.062 1.967Z" />
  </Svg>
);
export default SvgCallCancel;
