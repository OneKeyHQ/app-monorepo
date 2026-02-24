import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.5 18.5h-2V15h2zm3.5 0h-2V12h2zm3.5 0h-2V14h2z" />
    <Path
      fillRule="evenodd"
      d="M20 8.586V22H4V2h9.414zM6 20h12V10h-6V4H6zm8-12h2.586L14 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileGraph;
