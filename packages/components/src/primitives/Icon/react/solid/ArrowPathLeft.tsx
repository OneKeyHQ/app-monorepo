import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.399 4.824c.989-.815 2.48-.111 2.48 1.17v1.962h9.099c1.117 0 2.022.905 2.022 2.022v4.044a2.02 2.02 0 0 1-2.022 2.022h-9.099v1.962c0 1.281-1.491 1.985-2.48 1.17l-6.82-5.615a2.022 2.022 0 0 1 0-3.122L8.4 4.824Z" />
  </Svg>
);
export default SvgArrowPathLeft;
