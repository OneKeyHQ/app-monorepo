import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.306 15.076-.761.76c-.592.592-1.533.779-2.32.34a14 14 0 0 1-5.4-5.4c-.44-.788-.253-1.73.34-2.321l.76-.761-.811-2.703H5.106c.49 7.453 6.45 13.413 13.903 13.903v-3.008zM21 18.928c0 1.084-.891 2.03-2.052 1.96-8.506-.525-15.31-7.33-15.835-15.836C3.04 3.892 3.988 3 5.072 3h3.042c.879 0 1.654.577 1.907 1.42l.81 2.702c.211.702.02 1.463-.498 1.98l-.746.744a12 12 0 0 0 4.566 4.566l.745-.745a1.99 1.99 0 0 1 1.98-.499l2.703.811A1.99 1.99 0 0 1 21 15.886z" />
  </Svg>
);
export default SvgCall;
