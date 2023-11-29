import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSidebar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6m0-14h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8m0-14v14"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M6.125 8.75a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm0 3.25a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm0 3.25a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgSidebar;
