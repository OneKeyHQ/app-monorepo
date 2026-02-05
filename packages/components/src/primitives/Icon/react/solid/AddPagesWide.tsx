import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPagesWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V6a2 2 0 0 0-2-2zm2 10v-4a2 2 0 0 1 2-2h8V6H4v8zm6 1a1 1 0 1 1 0-2h1v-1a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPagesWide;
