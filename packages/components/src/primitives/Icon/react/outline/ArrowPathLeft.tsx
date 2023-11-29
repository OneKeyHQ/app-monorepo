import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 13v-2a2 2 0 0 0-2-2h-9V5.568a.5.5 0 0 0-.82-.384l-6.797 5.664a1.5 1.5 0 0 0 0 2.304l6.797 5.665a.5.5 0 0 0 .82-.384V15h9a2 2 0 0 0 2-2Z"
    />
  </Svg>
);
export default SvgArrowPathLeft;
