import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGasOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.707 2.293a1 1 0 0 0-1.414 1.414l1 1C3.104 5.098 3 5.537 3 6v13a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2v-2.586l5.293 5.293a1 1 0 0 0 1.414-1.414zM13 14.414 9.586 11H7a1 1 0 1 1 0-2h.586L5 6.414V19h8z"
      clipRule="evenodd"
    />
    <Path d="M18.293 5.293a1 1 0 0 1 1.414 0l1.414 1.414A3 3 0 0 1 22 8.828V16a1 1 0 1 1-2 0V8.828a1 1 0 0 0-.293-.707l-1.414-1.414a1 1 0 0 1 0-1.414" />
    <Path d="M9 3a1 1 0 0 0 0 2h3a1 1 0 0 1 1 1v3a2 2 0 0 0 2 2h1a1 1 0 0 1 1 1v1.5a1 1 0 1 0 2 0V12a3 3 0 0 0-3-3h-1V6a3 3 0 0 0-3-3z" />
  </Svg>
);
export default SvgGasOff;
