import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageMountains = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM7.5 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13.308 9.389a2 2 0 0 1 3.33.127l4.539 7.443C21.99 18.292 21.03 20 19.469 20H4.6c-1.59 0-2.544-1.764-1.674-3.094l2.668-4.08a2 2 0 0 1 2.837-.534l1.841 1.315 3.037-4.218Z"
    />
  </Svg>
);
export default SvgImageMountains;
