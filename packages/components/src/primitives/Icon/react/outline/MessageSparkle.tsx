import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageSparkle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 7a.57.57 0 0 1 .571.571c0 1.121.249 1.798.655 2.203.405.406 1.082.655 2.203.655a.571.571 0 1 1 0 1.142c-1.121 0-1.798.249-2.203.655-.406.405-.655 1.082-.655 2.203a.571.571 0 1 1-1.142 0c0-1.121-.249-1.798-.655-2.203-.405-.406-1.082-.655-2.203-.655a.571.571 0 0 1 0-1.142c1.121 0 1.798-.249 2.203-.655.406-.405.655-1.082.655-2.203A.57.57 0 0 1 12 7" />
    <Path
      fillRule="evenodd"
      d="M19.206 3.01A2 2 0 0 1 21.002 5v12.036a2 2 0 0 1-2 2h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004L8.65 19.036H5.002a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM5.002 17.037h3.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737a2 2 0 0 1 1.276-.46h3.626V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageSparkle;
