import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 10V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m4.188.837-2.213-8.25a.5.5 0 0 1 .612-.612l8.25 2.213a.5.5 0 0 1 .12.915l-3.65 2.114a.25.25 0 0 0-.09.09l-2.113 3.65a.5.5 0 0 1-.916-.12Z"
    />
  </Svg>
);
export default SvgCursorBox;
