import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSignature = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.414 6-15 15H2v-4.414l15-15zm.996 11.898-.653.756-.004.004-.006.007-.018.02-.058.064a7 7 0 0 1-.93.827c-.582.43-1.504.969-2.575.969-1.005 0-1.878-.464-2.503-.797l-.066-.035c-.723-.384-1.168-.598-1.61-.598-1.057 0-1.732.558-2.26 1.116l-.687.727-1.454-1.373.687-.727c.653-.691 1.824-1.743 3.713-1.743.987 0 1.85.46 2.47.79l.078.041c.718.381 1.173.599 1.632.599.429 0 .923-.235 1.384-.576a5 5 0 0 0 .658-.584l.031-.034.006-.006.651-.755z" />
  </Svg>
);
export default SvgSignature;
