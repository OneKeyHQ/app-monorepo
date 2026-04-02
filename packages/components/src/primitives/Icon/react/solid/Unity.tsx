import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUnity = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13 19.29 1.56-.878.981 1.743L12 22.148l-3.541-1.993.98-1.743L11 19.29V17h2zm-8-4.522 1.964-1.134 1 1.732-1.944 1.122 1.6.9-.981 1.744L3 17.085V13h2zm16 2.317-3.639 2.047-.98-1.743 1.6-.9-1.945-1.123 1-1.732L19 14.768V13h2zm-5.902-5.719L13 12.577V15h-2v-2.423l-2.098-1.21 1-1.733L12 10.844l2.098-1.21zM7.62 6.611l-1.6.9 1.944 1.123-1 1.732L5 9.233V11H3V6.915l3.639-2.047.98 1.743ZM21 6.915V11h-2V9.233l-1.964 1.133-1-1.732L17.98 7.51l-1.6-.9.981-1.743zm-5.459-3.07-.98 1.743L13 4.71V7h-2V4.71l-1.56.878-.981-1.743L12 1.853z" />
  </Svg>
);
export default SvgUnity;
