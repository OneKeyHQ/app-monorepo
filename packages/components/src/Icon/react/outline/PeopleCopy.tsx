import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleCopy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2m2.527 4a4.5 4.5 0 0 1 8.945 0M16 12.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm3 8.5H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"
    />
  </Svg>
);
export default SvgPeopleCopy;
