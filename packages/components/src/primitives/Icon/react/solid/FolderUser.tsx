import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7.126q0-.375-.095-.748a7.02 7.02 0 0 0-2.867-4.057A4.75 4.75 0 1 0 2 9.938zm0 10.063v.192l.088-.06z" />
    <Path
      fillRule="evenodd"
      d="M3.25 12.5a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1-5.5 0M6 11.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5M6 16c-1.76 0-3.306.91-4.195 2.28a1.69 1.69 0 0 0 .024 1.907c.349.504.943.813 1.587.813h5.168c.644 0 1.239-.31 1.588-.813a1.69 1.69 0 0 0 .024-1.908A5 5 0 0 0 6 16m0 2a3 3 0 0 1 2.236 1H3.764c.55-.615 1.349-1 2.236-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderUser;
