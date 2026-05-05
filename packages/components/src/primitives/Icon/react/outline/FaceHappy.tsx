import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceHappy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.999 14a4 4 0 1 1-8 0c2.683.277 5.317.277 8 0M9.738 7.593c.493.018.954.278 1.227.706.562.88.284 2.325-1.613 3.83l-.11.087-.132-.044c-2.298-.766-3.053-2.028-2.826-3.048.11-.495.455-.897.911-1.083a1.56 1.56 0 0 1 1.326.082 1.56 1.56 0 0 1 1.217-.53m4.526 0a1.56 1.56 0 0 1 1.217.53 1.56 1.56 0 0 1 1.326-.081c.456.186.8.587.91 1.082.228 1.02-.527 2.282-2.825 3.048l-.132.044-.109-.086c-1.897-1.506-2.176-2.95-1.614-3.831a1.53 1.53 0 0 1 1.227-.706" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceHappy;
