import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSchool = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 4a3 3 0 0 0-3 3v1H5a3 3 0 0 0-3 3v7a1 1 0 1 0 0 2h20a1 1 0 1 0 0-2v-7a3 3 0 0 0-3-3h-1V7a3 3 0 0 0-3-3H9Zm-4 6h1v8H4v-7a1 1 0 0 1 1-1Zm15 1v7h-2v-8h1a1 1 0 0 1 1 1Zm-8 4a2 2 0 0 0-2 2v1h4v-1a2 2 0 0 0-2-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSchool;
