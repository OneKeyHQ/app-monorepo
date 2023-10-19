import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSearchMenu = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.004 12h2m-2-5h3m-3 10h3m13.496-.5L22 19m-.996-7a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"
    />
  </Svg>
);
export default SvgSearchMenu;
