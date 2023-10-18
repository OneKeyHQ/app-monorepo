import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloseQuote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="#0F1419"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.004 5h-3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1v6s4-1.5 4-6V7a2 2 0 0 0-2-2Zm11 0h-3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1v6s4-1.5 4-6V7a2 2 0 0 0-2-2Z"
    />
  </Svg>
);
export default SvgCloseQuote;
