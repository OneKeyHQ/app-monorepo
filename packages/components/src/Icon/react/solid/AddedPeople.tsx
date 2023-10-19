import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm.6 14.7a2.987 2.987 0 0 0-.6 1.788v.02a2.995 2.995 0 0 0 1.2 2.392l.134.1H5.598c-1.135 0-2.192-1.014-1.902-2.304a9.23 9.23 0 0 1 .349-1.18 8.567 8.567 0 0 1 2.174-3.298C7.689 12.842 9.677 12 12 12c2.053 0 3.843.657 5.246 1.759l-1.165 1.942a3.001 3.001 0 0 0-3.48.999Z"
    />
    <Path
      fill="currentColor"
      d="M20.858 15.514a1 1 0 0 0-1.715-1.028l-2.43 4.049L15.6 17.7a1 1 0 1 0-1.2 1.6l2 1.5a1 1 0 0 0 1.458-.285l3-5Z"
    />
  </Svg>
);
export default SvgAddedPeople;
