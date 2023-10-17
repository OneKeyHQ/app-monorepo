import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraChangeLens = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 20v-3.25a.75.75 0 0 1 .75-.75h3M19.012 4v3.25a.75.75 0 0 1-.75.75h-3.25M4 12a8 8 0 0 1 8-8 8.136 8.136 0 0 1 6.5 3.242M20 12a8 8 0 0 1-8 8 8.136 8.136 0 0 1-6.5-3.242"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M11.125 12a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgCameraChangeLens;
