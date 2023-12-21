import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOpenQuote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="#0F1419"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16.004 19h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V5s-4 1.5-4 6v6a2 2 0 0 0 2 2Zm-11 0h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1V5s-4 1.5-4 6v6a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgOpenQuote;
