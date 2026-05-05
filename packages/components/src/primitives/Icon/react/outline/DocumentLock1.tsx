import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentLock1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 11h-2V4H6v16h5v2H4V2h16z" />
    <Path
      fillRule="evenodd"
      d="M17 13a3 3 0 0 1 3 3h1v6h-8v-6h1a3 3 0 0 1 3-3m-2 7h4v-2h-4zm2-5a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentLock1;
