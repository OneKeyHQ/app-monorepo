import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 13v-2a2 2 0 0 1 2-2h9V5.568a.5.5 0 0 1 .82-.384l6.797 5.664a1.5 1.5 0 0 1 0 2.304l-6.797 5.665a.5.5 0 0 1-.82-.384V15H5a2 2 0 0 1-2-2Z"
    />
  </Svg>
);
export default SvgArrowPathRight;
