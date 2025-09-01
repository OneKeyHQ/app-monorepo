// import { useCallback, useMemo } from 'react';

// import { useIntl } from 'react-intl';

// import { Page } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
// import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
// import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
// import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
// import { EarnProviderMirror } from '@onekeyhq/kit/src/views/Earn/EarnProviderMirror';
// import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// import { ETranslations } from '@onekeyhq/shared/src/locale';
// import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
// import type {
//   EModalStakingRoutes,
//   IModalStakingParamList,
// } from '@onekeyhq/shared/src/routes';
// import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
// import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
// import type { IApproveConfirmFnParams } from '@onekeyhq/shared/types/staking';
// import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
// import type { IToken } from '@onekeyhq/shared/types/token';

// import { ApproveBaseStake } from '../../components/ApproveBaseStake';
// import { useProviderLabel } from '../../hooks/useProviderLabel';
// import { useUniversalStake } from '../../hooks/useUniversalHooks';
// import { buildLocalTxStatusSyncId } from '../../utils/utils';

// const BasicApproveBaseStakePage = () => {
//   const route = useAppRoute<
//     IModalStakingParamList,
//     EModalStakingRoutes.ApproveBaseStake
//   >();

//   const { networkId, accountId, tokenInfo, protocolInfo, currentAllowance } =
//     route.params;
//   const appNavigation = useAppNavigation();
//   const actionTag = buildLocalTxStatusSyncId({
//     providerName: protocolInfo?.provider,
//     tokenSymbol: tokenInfo?.token.symbol,
//   });
//   const { removePermitCache } = useEarnActions().current;
//   const providerName = protocolInfo?.provider || '';

//   const handleStake = useUniversalStake({ accountId, networkId });
//   const onConfirm = useCallback(
//     async (params: IApproveConfirmFnParams) => {
//       await handleStake({
//         amount: params.amount,
//         stakingInfo: {
//           label: EEarnLabels.Stake,
//           protocol: earnUtils.getEarnProviderName({
//             providerName,
//           }),
//           protocolLogoURI: protocolInfo?.providerDetail.logoURI,
//           send: { token: tokenInfo?.token as IToken, amount: params.amount },
//           tags: [actionTag],
//         },
//         symbol: tokenInfo?.token.symbol || '',
//         provider: providerName,
//         protocolVault: earnUtils.isMorphoProvider({
//           providerName,
//         })
//           ? protocolInfo?.approve?.approveTarget
//           : undefined,
//         approveType: params.approveType,
//         permitSignature: params.permitSignature,
//         onSuccess: () => {
//           if (
//             params.approveType === EApproveType.Permit &&
//             params.permitSignature
//           ) {
//             removePermitCache({
//               accountId,
//               networkId,
//               tokenAddress: tokenInfo?.token.address || '',
//               amount: params.amount,
//             });
//           }
//           appNavigation.pop();
//           defaultLogger.staking.page.staking({
//             token: tokenInfo?.token,
//             stakingProtocol: providerName,
//           });
//         },
//       });
//     },
//     [
//       accountId,
//       actionTag,
//       appNavigation,
//       handleStake,
//       networkId,
//       protocolInfo?.approve?.approveTarget,
//       protocolInfo?.providerDetail.logoURI,
//       providerName,
//       removePermitCache,
//       tokenInfo?.token,
//     ],
//   );
//   const intl = useIntl();

//   const showEstReceive = useMemo<boolean>(
//     () =>
//       earnUtils.isLidoProvider({
//         providerName,
//       }) ||
//       earnUtils.isMorphoProvider({
//         providerName,
//       }),
//     [providerName],
//   );

//   const estReceiveTokenRate = useMemo(() => {
//     if (
//       earnUtils.isLidoProvider({
//         providerName,
//       })
//     ) {
//       return protocolInfo?.lidoStTokenRate;
//     }
//     if (
//       earnUtils.isMorphoProvider({
//         providerName,
//       })
//     ) {
//       return protocolInfo?.morphoTokenRate;
//     }
//     return '1';
//   }, [
//     protocolInfo?.lidoStTokenRate,
//     protocolInfo?.morphoTokenRate,
//     providerName,
//   ]);

//   const providerLabel = useProviderLabel(providerName);
//   const tokenSymbol = tokenInfo?.token.symbol || '';
//   const price = tokenInfo?.nativeToken?.price
//     ? String(tokenInfo?.nativeToken?.price)
//     : '0';
//   const balanceParsed = tokenInfo?.balanceParsed || '';
//   const minAmount = protocolInfo?.minStakeAmount || '';
//   const apr =
//     protocolInfo?.aprWithoutFee && Number(protocolInfo.aprWithoutFee) > 0
//       ? protocolInfo?.aprWithoutFee
//       : undefined;
//   const decimals = tokenInfo?.token.decimals || 0;
//   const rewardToken = tokenInfo?.token.symbol || '';
//   const token = tokenInfo?.token as IToken;
//   const approveType = protocolInfo?.approve?.approveType;

//   return (
//     <Page scrollEnabled>
//       <Page.Header
//         title={intl.formatMessage(
//           { id: ETranslations.earn_earn_token },
//           { token: tokenSymbol },
//         )}
//       />
//       <Page.Body>
//         <ApproveBaseStake
//           price={price}
//           balance={balanceParsed}
//           token={token}
//           approveType={approveType}
//           minAmount={minAmount}
//           decimals={decimals}
//           onConfirm={onConfirm}
//           apys={protocolInfo?.apys}
//           apr={apr}
//           currentAllowance={currentAllowance}
//           providerLogo={protocolInfo?.providerDetail.logoURI}
//           providerName={providerName}
//           providerLabel={providerLabel}
//           showEstReceive={showEstReceive}
//           estReceiveToken={rewardToken}
//           eventEndTime={protocolInfo?.eventEndTime}
//           estReceiveTokenRate={estReceiveTokenRate}
//           approveTarget={{
//             accountId,
//             networkId,
//             spenderAddress: protocolInfo?.approve?.approveTarget ?? '',
//             token,
//           }}
//           activeBalance={protocolInfo?.activeBalance}
//           rewardAssets={protocolInfo?.rewardAssets}
//           poolFee={protocolInfo?.poolFee}
//         />
//       </Page.Body>
//     </Page>
//   );
// };

// export default function ApproveBaseStakePage() {
//   return (
//     <AccountSelectorProviderMirror
//       config={{
//         sceneName: EAccountSelectorSceneName.home,
//         sceneUrl: '',
//       }}
//       enabledNum={[0]}
//     >
//       <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
//         <BasicApproveBaseStakePage />
//       </EarnProviderMirror>
//     </AccountSelectorProviderMirror>
//   );
// }
