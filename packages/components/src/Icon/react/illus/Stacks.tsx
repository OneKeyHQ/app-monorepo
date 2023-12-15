import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgStacks = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Circle cx="79.9" cy="79.9" r="79.9" fill="#5546FF" />
    <Path
      d="M112.5,122L95.3,95H120V84.8H39v10.2h24.7L46.5,122h12.8l20.2-31.7L99.7,122H112.5z M120,74.9V64.7H95.8  l17-26.7H99.9L79.5,70.2L59.1,38H46.2l17,26.7H39V75L120,74.9L120,74.9z"
      fill="#FFFFFF"
    />
  </Svg>
);
export default SvgStacks;
