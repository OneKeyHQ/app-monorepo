import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 10.618v2.764l4 2V8.617zM4 6v12h10V6zm12 2.382 3.83-1.914.188-.08A1.5 1.5 0 0 1 22 7.808v8.383a1.5 1.5 0 0 1-2.17 1.341L16 15.617V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgVideoCamera;
