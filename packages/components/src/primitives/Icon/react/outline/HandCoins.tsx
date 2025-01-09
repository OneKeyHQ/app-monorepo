import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandCoins = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.895 4.21a3.001 3.001 0 1 0-1.79 3.58m1.79-3.58a3 3 0 1 1-1.79 3.58m1.79-3.58c-1.403.556-2.184 2.134-1.79 3.58M7 20h2s2.392.923 4 1c3.546.169 6.363-1.48 8.645-3.99.521-.573.512-1.438.029-2.043-.624-.78-1.797-.843-2.579-.222-.861.684-2.005 1.453-3.095 1.755-1.505.417-3 .5-3 .5 8-.5 5-7-6-2.5M5 21a2 2 0 0 1-2-2v-4a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2Z"
    />
  </Svg>
);
export default SvgHandCoins;
