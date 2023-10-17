import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCubeView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 20H6a2 2 0 0 1-2-2v-2m12 4h2a2 2 0 0 0 2-2v-2M4 8V6a2 2 0 0 1 2-2h2m8 0h2a2 2 0 0 1 2 2v2m-5 2.286L12 12m0 0-3-1.714M12 12v3.5m-.496-7.216-2.5 1.428a1 1 0 0 0-.504.868v2.84a1 1 0 0 0 .504.868l2.5 1.428a1 1 0 0 0 .992 0l2.5-1.428a1 1 0 0 0 .504-.868v-2.84a1 1 0 0 0-.504-.868l-2.5-1.428a1 1 0 0 0-.992 0Z"
    />
  </Svg>
);
export default SvgCubeView;
