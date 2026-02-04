import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 17.75a4.25 4.25 0 0 1 7.521-2.712A3.501 3.501 0 0 1 9 22H6.25A4.25 4.25 0 0 1 2 17.75m2-7.25V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9v11a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2h3V10h-4a2 2 0 0 1-2-2V4H6v6.5a1 1 0 1 1-2 0m0 7.25A2.25 2.25 0 0 0 6.25 20H9a1.5 1.5 0 0 0 0-3h-.009a1 1 0 0 1-.845-.46A2.25 2.25 0 0 0 4 17.75M16.586 8 14 5.414V8z" />
  </Svg>
);
export default SvgFileCloud;
