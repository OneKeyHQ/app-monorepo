import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLightning = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.06 2a1.5 1.5 0 0 0-1.341.83l-4.5 9A1.5 1.5 0 0 0 4.56 14h3.065l-2.007 6.187c-.472 1.456 1.282 2.6 2.425 1.583L21.686 9.62c1.03-.917.38-2.62-.998-2.62h-3.92l1.637-2.728A1.5 1.5 0 0 0 17.118 2H9.061Z"
    />
  </Svg>
);
export default SvgLightning;
