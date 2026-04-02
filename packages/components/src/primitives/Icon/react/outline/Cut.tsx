import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCut = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 3a4 4 0 0 1 3.778 5.317l3.722 2.48 6.53-4.352 2.357.832-12.609 8.406a4 4 0 1 1-1.11-1.663l3.03-2.02-3.03-2.02A4 4 0 1 1 6 3m0 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path d="M22.387 16.723 20 17.535l-5.599-3.732 1.803-1.202z" />
  </Svg>
);
export default SvgCut;
