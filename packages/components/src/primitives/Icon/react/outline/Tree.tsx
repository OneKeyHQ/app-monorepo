import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTree = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a9 9 0 0 1 1 17.942V22h-2v-2.058A9 9 0 0 1 12 2m0 2a7 7 0 0 0-1 13.927v-2.513L8.586 13 10 11.586l2 2 3-3L16.414 12 13 15.414v2.513A7 7 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTree;
