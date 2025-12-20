import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAttachment = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.486 3.118A3.8 3.8 0 0 1 17.184 2c.975 0 1.954.373 2.698 1.118A3.8 3.8 0 0 1 21 5.818a3.8 3.8 0 0 1-1.117 2.698l-9.956 9.961a2.41 2.41 0 0 1-3.406 0l.707-.707-.707.707a2.41 2.41 0 0 1 0-3.406l4.978-4.98a1 1 0 0 1 1.415 1.414l-4.978 4.98a.41.41 0 0 0 .576.578l9.956-9.96A1.8 1.8 0 0 0 19 5.817c0-.466-.177-.93-.532-1.285A1.8 1.8 0 0 0 17.184 4c-.466 0-.929.177-1.284.532l-9.956 9.96A3.21 3.21 0 0 0 5 16.775c0 .827.315 1.651.944 2.281a3.2 3.2 0 0 0 2.28.945 3.2 3.2 0 0 0 2.28-.945l4.977-4.98a1 1 0 0 1 1.415 1.414l-4.978 4.98A5.2 5.2 0 0 1 8.224 22a5.2 5.2 0 0 1-3.694-1.53A5.21 5.21 0 0 1 3 16.773c0-1.336.51-2.675 1.53-3.695z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAttachment;
