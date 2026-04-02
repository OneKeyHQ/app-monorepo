import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolders = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m12.414 3 2 2H23v12h-4v4H1V7h4V3zM7 7h1.414l2 2H19v6h2V7h-7.414l-2-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolders;
