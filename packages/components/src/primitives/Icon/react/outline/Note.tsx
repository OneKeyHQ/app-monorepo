import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 3a2 2 0 0 1 2 2v9.086a2 2 0 0 1-.586 1.414L15.5 20.414a2 2 0 0 1-1.414.586H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 19h8v-4a2 2 0 0 1 2-2h4V5H5zm10-4v3.086L18.086 15z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNote;
