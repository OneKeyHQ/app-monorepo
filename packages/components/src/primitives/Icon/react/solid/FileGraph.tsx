import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 10h8v12H4V2h8zm-4.5 9h2v-3.5h-2zm3.5-6.5V19h2v-6.5zm3.5 6.5h2v-4.5h-2z"
      clipRule="evenodd"
    />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFileGraph;
