import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2z"
    />
  </Svg>
);
export default SvgFolderOpen;
