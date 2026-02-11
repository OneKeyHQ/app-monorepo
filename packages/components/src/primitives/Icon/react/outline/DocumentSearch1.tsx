import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentSearch1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 15.172a4 4 0 0 1 6.274 4.86l1.261 1.261a1 1 0 0 1-1.414 1.414l-1.26-1.26a4.001 4.001 0 0 1-4.86-6.275Zm4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
    <Path d="M18 2a2 2 0 0 1 2 2v7a1 1 0 1 1-2 0V4H5v16h5.5a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <Path d="M9 14a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2zm2-4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgDocumentSearch1;
