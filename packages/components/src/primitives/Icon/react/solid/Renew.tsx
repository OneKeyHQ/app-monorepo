import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRenew = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 3c1.192 0 2.332.232 3.375.654l.017.007.617.276-.818 1.826-.583-.261A7 7 0 0 0 8 17.745V14h2v7H3v-2h3.343A9 9 0 0 1 12 3m1 16a1 1 0 1 1 0 2 1 1 0 0 1 0-2m3.367-1.437a1 1 0 1 1 1 1.732 1 1 0 0 1-1-1.733Zm2.197-2.929a1 1 0 1 1 1.732 1 1 1 0 0 1-1.732-1M20 10a1 1 0 1 1 0 2 1 1 0 0 1 0-2m-2.073-3.732a1 1 0 1 1 1 1.733 1 1 0 0 1-1-1.733" />
  </Svg>
);
export default SvgRenew;
