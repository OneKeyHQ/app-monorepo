import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicStickTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 9c.998 0 1.947.268 2.676.754C15.398 10.235 16 11.009 16 12v11H8V12c0-.99.603-1.765 1.324-2.246C10.053 9.268 11.002 9 12 9m2 5.608A5.1 5.1 0 0 1 12 15a5.1 5.1 0 0 1-2-.392V18c0 .114.07.34.434.582.357.238.908.418 1.566.418.659 0 1.21-.18 1.566-.418.364-.243.434-.468.434-.582zM12 11c-.659 0-1.21.18-1.566.418-.364.243-.434.468-.434.582s.07.34.434.582c.357.238.908.418 1.566.418.659 0 1.21-.18 1.566-.418.364-.243.434-.468.434-.582s-.07-.34-.434-.582C13.21 11.18 12.658 11 12 11"
      clipRule="evenodd"
    />
    <Path d="m6 7 2 1-2 1-1 2-1-2-2-1 2-1 1-2zm14 0 2 1-2 1-1 2-1-2-2-1 2-1 1-2zm-7-4 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
  </Svg>
);
export default SvgMagicStickTop;
