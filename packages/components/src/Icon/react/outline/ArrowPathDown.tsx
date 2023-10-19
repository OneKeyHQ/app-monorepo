import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 3h-2a2 2 0 0 0-2 2v9H5.568a.5.5 0 0 0-.385.82l5.665 6.797a1.5 1.5 0 0 0 2.304 0l5.665-6.797a.5.5 0 0 0-.384-.82H15V5a2 2 0 0 0-2-2Z"
    />
  </Svg>
);
export default SvgArrowPathDown;
