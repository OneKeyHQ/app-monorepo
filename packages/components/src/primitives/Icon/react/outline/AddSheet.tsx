import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddSheet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h3m0 0h3m-3 0v3m0-3V9M5 19V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
    />
  </Svg>
);
export default SvgAddSheet;
