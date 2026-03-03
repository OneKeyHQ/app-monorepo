import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAccessibilityEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.797 5.383a11 11 0 0 1 3.188-1.184c4.885-.973 9.942 1.617 12.903 7.342l.237.459-.237.46a16.8 16.8 0 0 1-2.124 3.192 14 14 0 0 1-1.872 1.825L22.414 21 21 22.414l-3.797-3.797c-1.02.57-2.093.966-3.188 1.184-4.885.973-9.942-1.616-12.903-7.341L.874 12l.238-.46a16.8 16.8 0 0 1 2.124-3.19 14 14 0 0 1 1.873-1.827L1.586 3 3 1.586zM4.087 10.5q-.502.693-.952 1.499c2.173 3.9 5.326 5.824 8.438 5.987zm2.445-2.554q-.592.455-1.15 1.02l8.753 8.754a9 9 0 0 0 1.585-.586zM12 9a3 3 0 0 0-1.294.292l4.001 4.002A3 3 0 0 0 12 9"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAccessibilityEye;
