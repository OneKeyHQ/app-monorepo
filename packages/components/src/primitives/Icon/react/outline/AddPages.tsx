import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M15 7V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2m5-5v2m0 0v2m0-2h-2m2 0h2m1 7h-6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"
    />
  </Svg>
);
export default SvgAddPages;
