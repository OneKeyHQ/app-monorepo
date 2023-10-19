import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicStickStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11.928 3.391c-.847-.72-2.142-.06-2.057 1.048l.278 3.599-3.075 1.89c-.947.583-.72 2.02.362 2.28l2.369.573-6.512 6.512a1 1 0 1 0 1.414 1.414l6.512-6.512.573 2.37c.26 1.08 1.697 1.308 2.28.36l1.89-3.074 3.599.278c1.108.085 1.769-1.21 1.048-2.057l-2.34-2.748 1.376-3.337c.424-1.028-.604-2.056-1.632-1.632l-3.337 1.376-2.748-2.34Z"
    />
  </Svg>
);
export default SvgMagicStickStar;
