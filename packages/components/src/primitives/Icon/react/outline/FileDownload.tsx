import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 20V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9v11a2 2 0 0 1-2 2h-1.5a1 1 0 1 1 0-2H18V10h-4a2 2 0 0 1-2-2V4H6v16h1.5a1 1 0 1 1 0 2H6a2 2 0 0 1-2-2m7-6a1 1 0 1 1 2 0v3.586l.793-.793a1 1 0 1 1 1.414 1.414l-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793zm5.586-6L14 5.414V8z" />
  </Svg>
);
export default SvgFileDownload;
