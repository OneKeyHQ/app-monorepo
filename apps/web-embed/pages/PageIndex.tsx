import { Link } from 'react-router-dom';

import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';

export default function PageIndex() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>PageIndex</h1>
      <ul>
        <li>
          <Link to={EWebEmbedRoutePath.webEmbedApi}>WebEmbedApi</Link>
        </li>
        <li>
          <Link to={EWebEmbedRoutePath.primePurchase}>PrimePurchase</Link>
        </li>
      </ul>
    </div>
  );
}
