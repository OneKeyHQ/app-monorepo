import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgComputer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 13H3m7 4h4v4h-4v-4Zm-5 0h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgComputer;
