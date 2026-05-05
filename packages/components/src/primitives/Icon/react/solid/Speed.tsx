import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeed = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.929 5.929c3.905-3.905 10.237-3.905 14.142 0 3.773 3.773 3.9 9.811.382 13.738l-.667.745-1.49-1.335.668-.744a8.001 8.001 0 1 0-11.928 0l.667.744-1.49 1.335-.666-.745C1.028 15.74 1.155 9.702 4.929 5.93Z" />
    <Path d="M13.414 13 12 14.414 7.586 10 9 8.586z" />
  </Svg>
);
export default SvgSpeed;
