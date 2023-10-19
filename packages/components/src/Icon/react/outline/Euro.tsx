import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEuro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 9.2c-.635-.74-1.52-1.2-2.5-1.2C10.567 8 9 9.79 9 12s1.567 4 3.5 4c.98 0 1.865-.46 2.5-1.2M8 12h3m10 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgEuro;
