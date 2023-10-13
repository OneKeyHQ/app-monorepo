import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderUser = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 6a3 3 0 0 1 3-3h3.93a3 3 0 0 1 2.496 1.336l.812 1.219A1 1 0 0 0 13.07 6H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.126c0-.25-.031-.5-.095-.748a7.015 7.015 0 0 0-2.867-4.057A4.75 4.75 0 1 0 2 9.938V6Zm0 9.063v.192l.088-.06A4.784 4.784 0 0 1 2 15.063Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.25 12.5a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1-5.5 0ZM6 11.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM6 16c-1.76 0-3.306.91-4.195 2.28a1.689 1.689 0 0 0 .024 1.907c.349.504.943.813 1.587.813h5.168c.644 0 1.239-.31 1.588-.813a1.69 1.69 0 0 0 .024-1.908A4.997 4.997 0 0 0 6 16Zm0 2a2.99 2.99 0 0 1 2.236 1H3.764c.55-.615 1.349-1 2.236-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderUser;
