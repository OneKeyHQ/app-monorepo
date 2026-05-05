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
      d="M2.293 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 0 1-1.414 1.414L15 16.414V19a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2V6c0-.463.105-.902.292-1.293l-.999-1a1 1 0 0 1 0-1.414M7 9a1 1 0 0 0 0 2h2.586l-2-2z"
      clipRule="evenodd"
    />
    <Path d="M18.293 5.293a1 1 0 0 1 1.414 0l1.414 1.414A3 3 0 0 1 22 8.828V16a1 1 0 1 1-2 0V8.828a1 1 0 0 0-.293-.707l-1.414-1.414a1 1 0 0 1 0-1.414" />
    <Path d="M12 3a3 3 0 0 1 3 3v3h1a3 3 0 0 1 3 3v1.5a1 1 0 1 1-2 0V12a1 1 0 0 0-1-1l-.75-.172a2 2 0 0 1-2-2L13 6a1 1 0 0 0-1-1H9a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgGasOff;
