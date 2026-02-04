import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 2h6v6a2 2 0 0 0 2 2h6v10a2 2 0 0 1-2 2h-5.17c.11-.313.17-.65.17-1v-4c0-.98-.47-1.852-1.198-2.399A5.002 5.002 0 0 0 4 12V4a2 2 0 0 1 2-2" />
    <Path d="M14 2.586 19.414 8H14z" />
    <Path
      fillRule="evenodd"
      d="M3 17a1 1 0 0 1 1-1 3 3 0 1 1 6 0 1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm6 1H5v2h4zm-1-2a1 1 0 1 0-2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileLock;
