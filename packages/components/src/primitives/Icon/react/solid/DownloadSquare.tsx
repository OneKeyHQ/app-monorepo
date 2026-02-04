import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownloadSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm6 12a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2zm5.707-5.293-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414l.293.293V8a1 1 0 1 1 2 0v2.586l.293-.293a1 1 0 1 1 1.414 1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadSquare;
