import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSignature = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.414 6-15 15H2v-4.414l15-15zM4 17.414V19h1.586l13-13L17 4.414z"
      clipRule="evenodd"
    />
    <Path d="m22.41 17.896-.653.757-.002.002-.002.003-.006.007-.017.02-.06.064a7 7 0 0 1-.93.826c-.58.43-1.503.969-2.574.969-1.041 0-1.94-.497-2.568-.831-.724-.384-1.169-.598-1.612-.598-1.056 0-1.732.558-2.26 1.116l-.686.727-1.454-1.374.687-.727c.654-.691 1.825-1.742 3.713-1.742 1.03 0 1.926.5 2.55.831.716.381 1.171.598 1.63.598.429 0 .923-.234 1.384-.575a5 5 0 0 0 .69-.62l.004-.003.652-.756z" />
  </Svg>
);
export default SvgSignature;
