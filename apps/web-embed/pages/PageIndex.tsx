import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';

function buildWebEmbedRouteHref(routePath: EWebEmbedRoutePath) {
  return `#${routePath}`;
}

export default function PageIndex() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>PageIndex</h1>
      <ul>
        <li>
          <a href={buildWebEmbedRouteHref(EWebEmbedRoutePath.webEmbedApi)}>
            WebEmbedApi
          </a>
        </li>
        <li>
          <a href={buildWebEmbedRouteHref(EWebEmbedRoutePath.primePurchase)}>
            PrimePurchase
          </a>
        </li>
      </ul>
    </div>
  );
}
