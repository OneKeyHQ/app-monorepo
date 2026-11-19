import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function createEarnDesktopHomeCopy(intl: IntlShape) {
  function format(id: ETranslations, values?: Record<string, string | number>) {
    return intl.formatMessage({ id }, values);
  }
  return {
    get withdrawals() {
      return format(ETranslations.earn_withdrawals__title);
    },
    get intro() {
      return format(ETranslations.earn_intro__title);
    },
    get aYear() {
      return format(ETranslations.earn_a_year__title);
    },
    more: (count: number) => format(ETranslations.earn_more__desc, { count }),
    get payWith() {
      return format(ETranslations.wc_pay_pay_with__label);
    },
    get youDeposit() {
      return format(ETranslations.earn_you_deposit__title);
    },
    get youSupply() {
      return format(ETranslations.earn_you_supply__title);
    },
    swapAnd: (action: string) =>
      format(ETranslations.earn_swap_and__action, { action }),
    bridgeAnd: (action: string) =>
      format(ETranslations.earn_bridge_and__action, { action }),
    approveAnd: (action: string) =>
      format(ETranslations.earn_approve_and__action, { action }),
    get estAnnualRewards() {
      return format(ETranslations.earn_est_annual_rewards__title);
    },
    alsoBacksLoan: (market?: string) =>
      market
        ? format(ETranslations.earn_collateral_backs_market_loan__desc, {
            market,
          })
        : format(ETranslations.earn_collateral_backs_loan__desc),
    get atMaturityYouGet() {
      return format(ETranslations.earn_at_maturity_you_get__title);
    },
    get pendleRowTitles() {
      return [
        format(ETranslations.earn_pendle_effective_fixed_apy__title),
        format(ETranslations.earn_pendle_market_reference_apy__title),
        format(ETranslations.earn_pendle_min_received__title),
      ];
    },
    get pendleSellRowTitles() {
      return [
        format(ETranslations.earn_pendle_effective_fixed_apy__title),
        format(ETranslations.earn_pendle_sell_row_titles_1__desc),
        format(ETranslations.earn_at_maturity_you_get__title),
      ];
    },
    get pendleSellDetailTitles() {
      return [
        format(ETranslations.earn_pendle_market_reference_apy__title),
        format(ETranslations.earn_pendle_min_received__title),
        format(ETranslations.fee_fee),
      ];
    },
    get pendleSellNote() {
      return format(ETranslations.earn_pendle_sell_note__desc);
    },
    get pendleRateRowTitles() {
      return [
        format(ETranslations.earn_pendle_effective_fixed_apy__title),
        format(ETranslations.earn_pendle_market_reference_apy__title),
      ];
    },
    earnMoreOn: (symbol: string) =>
      format(ETranslations.earn_earn_more_on__action, { symbol }),
    paysRate: (protocol: string, rate: string) =>
      format(ETranslations.earn_pays_rate__desc, { protocol, rate }),
    depositedTo: (amount: string, target: string) =>
      format(ETranslations.earn_deposited_to__desc, { amount, target }),
    withdrewFrom: (amount: string, target: string) =>
      format(ETranslations.earn_withdrew_from__desc, { amount, target }),
    get readyToEarn() {
      return format(ETranslations.earn_ready_to_earn__title);
    },
    get readyToEarnInfo() {
      return format(ETranslations.earn_ready_to_earn_info__desc);
    },
    get inYourWallet() {
      return format(ETranslations.earn_in_your_wallet__title);
    },
    showMore: (count: number) =>
      format(ETranslations.address_risk_check_show_more_exposures__action, {
        count,
      }),
    loanNetApyHeader: (ltv: string) =>
      format(ETranslations.earn_loan_net_apy_header__title, { ltv }),
    get networkPairs() {
      return format(ETranslations.earn_network_pairs__title);
    },
    loanNetApyInfo: (ltv: string) =>
      format(ETranslations.earn_loan_net_apy_info__desc, { ltv }),
    get guideTitle() {
      return format(ETranslations.earn_guide_title__title);
    },
    get guideSteps() {
      return [
        format(ETranslations.earn_guide_add_eth_step__title),
        format(ETranslations.earn_guide_choose_vault__title),
        format(ETranslations.earn_guide_deposit_usdc__title),
        format(ETranslations.earn_guide_view_portfolio_step__title),
      ];
    },
    get guideActions() {
      return [
        format(ETranslations.earn_guide_add_eth__action),
        format(ETranslations.earn_guide_choose_vault__title),
        format(ETranslations.earn_deposit),
        format(ETranslations.earn_my_portfolio__title),
      ];
    },
    get guideGasTitle() {
      return format(ETranslations.earn_guide_gas_title__title);
    },
    guideGasBody: (amount: string) =>
      format(ETranslations.earn_guide_gas_body__desc, { amount }),
    get guideGasWaiting() {
      return format(ETranslations.earn_guide_gas_waiting__desc);
    },
    get guideGasReceived() {
      return format(ETranslations.earn_guide_gas_received__desc);
    },
    get guideConnect() {
      return format(ETranslations.earn_guide_connect__desc);
    },
    get guideVaultTitle() {
      return format(ETranslations.earn_guide_choose_vault__title);
    },
    get guideVaultBody() {
      return format(ETranslations.earn_guide_vault_body__desc);
    },
    get guideUseVault() {
      return format(ETranslations.earn_guide_use_vault__action);
    },
    get guideDepositTitle() {
      return format(ETranslations.earn_guide_deposit_usdc__title);
    },
    get guideWithdrawNote() {
      return format(ETranslations.earn_guide_withdraw_note__desc);
    },
    get guideDoneTitle() {
      return format(ETranslations.earn_guide_done_title__title);
    },
    get guideDoneBody() {
      return format(ETranslations.earn_guide_done_body__desc);
    },
    get guideGoToPortfolio() {
      return format(ETranslations.earn_my_portfolio__title);
    },
    get supplyAndBorrow() {
      return format(ETranslations.earn_supply_and_borrow__action);
    },
    get swapSupplyAndBorrow() {
      return format(ETranslations.earn_swap_supply_and_borrow__action);
    },
    get loanLtv() {
      return format(ETranslations.earn_loan_ltv__title);
    },
    get loanCurrentLtv() {
      return format(ETranslations.earn_loan_current_ltv__title);
    },
    loanMaxShort: (ltv: string) =>
      format(ETranslations.earn_loan_max_short__desc, { ltv }),
    get loanPosition() {
      return format(ETranslations.earn_loan_position__title);
    },
    get yourLoans() {
      return format(ETranslations.earn_your_loans__title);
    },
    get loanPoolInfo() {
      return format(ETranslations.earn_loan_pool_info__desc);
    },
    get loanLiquidationPrice() {
      return format(ETranslations.earn_loan_liquidation_price__title);
    },
    loanBelowNow: (percent: string) =>
      format(ETranslations.earn_loan_below_now__desc, { percent }),
    loanNoAccount: (network: string) =>
      format(ETranslations.earn_loan_no_account__msg, { network }),
    noFundsOnNetwork: (network: string) =>
      format(ETranslations.earn_no_funds_on_network__msg, { network }),
    onNetwork: (network: string) =>
      format(ETranslations.earn_on_network__desc, { network }),
    get bonus() {
      return format(ETranslations.earn_bonus__title);
    },
    get endsIn() {
      return format(ETranslations.earn_ends_in__title);
    },
    days: (count: number) =>
      format(ETranslations.prime_gift_days__desc, { count }),
    get maturity() {
      return format(ETranslations.earn_pendle_sell_row_titles_1__desc);
    },
    get fixedRateEarlySale() {
      return format(ETranslations.earn_fixed_rate_early_sale__desc);
    },
    loanNotLent: (symbol: string, eMode?: string) =>
      eMode
        ? format(ETranslations.earn_loan_emode_asset_unavailable__msg, {
            symbol,
            eMode,
          })
        : format(ETranslations.earn_loan_asset_unavailable__msg, { symbol }),
    loanLiquidity: (amount: string) =>
      format(ETranslations.earn_loan_liquidity__msg, { amount }),
    loanMaxLtv: (ltv: string, wouldBe?: string) =>
      wouldBe
        ? format(ETranslations.earn_loan_projected_ltv_above_max__msg, {
            ltv,
            wouldBe,
          })
        : format(ETranslations.earn_loan_max_ltv__msg, { ltv }),
    loanNoMarket: (collateral: string, borrow: string) =>
      format(ETranslations.earn_loan_no_market__msg, { collateral, borrow }),
    get loanLanding() {
      return format(ETranslations.earn_loan_landing__desc);
    },
    get loanSupplyLanding() {
      return format(ETranslations.earn_loan_supply_landing__desc);
    },
    loanSupplied: (amount: string, market: string) =>
      format(ETranslations.earn_loan_supplied__desc, { amount, market }),
    classMembers: (shown: string[], remaining: number) => {
      const locale = intl.locale;
      const separator =
        locale.startsWith('zh') || locale.startsWith('ja') ? '、' : ', ';
      const joined = shown.join(separator);
      return remaining > 0
        ? format(ETranslations.earn_class_members__desc, {
            shown: joined,
            remaining,
          })
        : joined;
    },
    assetSelectNoEarn: (network: string) =>
      format(ETranslations.earn_asset_select_no_earn__msg, { network }),
    get assetSelectNoLoan() {
      return format(ETranslations.earn_asset_select_no_loan__msg);
    },
    earnClassHint: (kind: string) =>
      format(ETranslations.earn_earn_class_hint__action, { kind }),
    loanDone: (borrowed: string, market: string, supplied?: string) =>
      supplied
        ? format(ETranslations.earn_loan_supplied_and_borrowed__desc, {
            borrowed,
            market,
            supplied,
          })
        : format(ETranslations.earn_loan_borrowed__desc, { borrowed, market }),
    loanSupplyDone: (supplied: string, market: string) =>
      format(ETranslations.earn_loan_supply_done__desc, { supplied, market }),
    loanAssetOn: (symbol: string, market: string) =>
      format(ETranslations.earn_loan_asset_on__desc, { symbol, market }),
    get loanBridgeSupplyAndBorrow() {
      return format(ETranslations.earn_loan_bridge_supply_and_borrow__action);
    },
    assetSelectAllOfKind: (kind: string) =>
      format(ETranslations.earn_asset_select_all_of_kind__title, { kind }),
    get assetSelectNoEarnAnywhere() {
      return format(ETranslations.earn_asset_select_no_earn_anywhere__msg);
    },
  };
}

export type IEarnDesktopHomeCopy = ReturnType<typeof createEarnDesktopHomeCopy>;

export function useEarnDesktopHomeCopy() {
  const intl = useIntl();
  return useMemo(() => createEarnDesktopHomeCopy(intl), [intl]);
}
