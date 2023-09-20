import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgAndroid = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 22 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.881 0a.206.206 0 0 0-.1.027.205.205 0 0 0-.082.287l1.046 1.889c-2.012 1.047-3.37 3.036-3.374 5.32h13.24c-.002-2.284-1.361-4.273-3.373-5.32l1.046-1.89a.205.205 0 0 0-.082-.286.208.208 0 0 0-.286.082l-1.06 1.91a7.057 7.057 0 0 0-2.864-.6 7.057 7.057 0 0 0-2.865.6L7.067.109A.208.208 0 0 0 6.882 0Zm-2.51 8.045v9.596c0 .887.714 1.6 1.6 1.6h1.063v3.274c0 .827.657 1.485 1.484 1.485s1.485-.658 1.485-1.485v-3.273h1.977v3.273c0 .827.658 1.485 1.485 1.485.827 0 1.485-.658 1.485-1.485v-3.273h1.061c.887 0 1.6-.714 1.6-1.6V8.044H4.372Zm3.565-4.05a.556.556 0 0 0-.552.552c0 .302.25.552.552.552.302 0 .552-.25.552-.552a.556.556 0 0 0-.552-.553Zm6.11 0a.556.556 0 0 0-.552.552c0 .302.25.552.553.552.302 0 .552-.25.552-.552a.556.556 0 0 0-.552-.553ZM2.336 7.79C1.508 7.79.85 8.449.85 9.275v6.184c0 .827.658 1.484 1.485 1.484.826 0 1.484-.657 1.484-1.484V9.275c0-.826-.658-1.484-1.484-1.484Zm17.314 0c-.827 0-1.485.658-1.485 1.484v6.184c0 .827.658 1.484 1.485 1.484.826 0 1.484-.657 1.484-1.484V9.275c0-.826-.658-1.484-1.484-1.484Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAndroid;
