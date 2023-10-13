import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLightning = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m4.112 12.276 4.5-9A.5.5 0 0 1 9.059 3h8.058a.5.5 0 0 1 .429.757l-2.091 3.486a.5.5 0 0 0 .428.757h4.804a.5.5 0 0 1 .333.873L7.377 21.023c-.38.34-.965-.042-.808-.527l2.219-6.842A.5.5 0 0 0 8.312 13H4.56a.5.5 0 0 1-.447-.724Z"
    />
  </Svg>
);
export default SvgLightning;
