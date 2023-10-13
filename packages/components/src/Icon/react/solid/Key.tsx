import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgKey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 12a6 6 0 0 1 10.816-3.578c.028.037.057.06.077.07a.075.075 0 0 0 .017.008h8.11a2 2 0 0 1 1.561.75l1.2 1.5a2 2 0 0 1 0 2.5l-1.2 1.5a2 2 0 0 1-1.562.75H18a.999.999 0 0 1-.447-.106L16 14.618l-1.553.776A.999.999 0 0 1 14 15.5h-2.09a.074.074 0 0 0-.017.007.257.257 0 0 0-.077.072A6 6 0 0 1 1 12Zm6 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKey;
