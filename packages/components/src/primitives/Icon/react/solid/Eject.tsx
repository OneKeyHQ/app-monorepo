import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEject = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17 15a3 3 0 1 1 0 6H7a3 3 0 1 1 0-6zM12 2c.766 0 1.536.293 2.121.879l5 5a2.99 2.99 0 0 1 .706 3.116q-.025.076-.055.153a3 3 0 0 1-.122.258q-.04.071-.083.139c-.023.038-.043.077-.068.114q-.046.066-.095.128-.037.053-.079.107a3 3 0 0 1-.194.217l-.01.01A3 3 0 0 1 17 13H7a3 3 0 0 1-2.12-.88l-.001.001-.01-.01a3 3 0 0 1-.194-.217q-.04-.053-.08-.107c-.031-.042-.065-.084-.094-.128q-.036-.056-.068-.114-.044-.068-.083-.139a3 3 0 0 1-.122-.258q-.03-.076-.055-.153a2.993 2.993 0 0 1 .706-3.116l5-5A3 3 0 0 1 12 2"
    />
  </Svg>
);
export default SvgEject;
