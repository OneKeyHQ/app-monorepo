import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOnekeyLogo = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 15.887a1.56 1.56 0 1 0 0-3.118 1.56 1.56 0 0 0 0 3.118Z" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 21c6.213 0 9-2.787 9-9s-2.787-9-9-9-9 2.787-9 9 2.787 9 9 9ZM10.31 6.816h2.503v4.126h-1.552V8.145H9.87l.438-1.329ZM12 17.184a2.855 2.855 0 1 0 0-5.711 2.855 2.855 0 0 0 0 5.71Z"
    />
  </Svg>
);
export default SvgOnekeyLogo;
