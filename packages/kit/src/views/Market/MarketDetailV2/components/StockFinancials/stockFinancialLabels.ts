// cspell:ignore financials
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IStockFinancialLabels } from './financialChartData';

export function useStockFinancialLabels(): IStockFinancialLabels {
  const intl = useIntl();
  return useMemo(
    () => ({
      financials: intl.formatMessage({
        id: ETranslations.market_stock_financials__title,
      }),
      annual: intl.formatMessage({
        id: ETranslations.market_stock_financials_annual__action,
      }),
      quarter: intl.formatMessage({
        id: ETranslations.market_stock_financials_quarterly__action,
      }),
      performance: intl.formatMessage({
        id: ETranslations.market_stock_financials_performance__title,
      }),
      conversion: intl.formatMessage({
        id: ETranslations.market_stock_financials_revenue_to_profit__title,
      }),
      debt: intl.formatMessage({
        id: ETranslations.market_stock_financials_debt_coverage__title,
      }),
      earnings: intl.formatMessage({
        id: ETranslations.market_stock_financials_earnings__title,
      }),
      revenue: intl.formatMessage({
        id: ETranslations.market_stock_financials_revenue__title,
      }),
      costOfRevenue: intl.formatMessage({
        id: ETranslations.market_stock_financials_cogs__title,
      }),
      grossProfit: intl.formatMessage({
        id: ETranslations.market_stock_financials_gross_profit__title,
      }),
      operatingExpenses: intl.formatMessage({
        id: ETranslations.market_stock_financials_operating_expenses__title,
      }),
      operatingIncome: intl.formatMessage({
        id: ETranslations.market_stock_financials_operating_income__title,
      }),
      nonOperatingIncomeExpenses: intl.formatMessage({
        id: ETranslations.market_stock_financials_non_operating_income_expenses__title,
      }),
      incomeBeforeTax: intl.formatMessage({
        id: ETranslations.market_stock_financials_pre_tax_income__title,
      }),
      incomeTaxExpense: intl.formatMessage({
        id: ETranslations.market_stock_financials_taxes__title,
      }),
      netIncome: intl.formatMessage({
        id: ETranslations.market_stock_financials_net_income__title,
      }),
      netMargin: intl.formatMessage({
        id: ETranslations.market_stock_financials_net_margin__title,
      }),
      totalDebt: intl.formatMessage({
        id: ETranslations.market_stock_financials_debt__title,
      }),
      freeCashFlow: intl.formatMessage({
        id: ETranslations.market_stock_financials_free_cash_flow__title,
      }),
      cashAndCashEquivalents: intl.formatMessage({
        id: ETranslations.market_stock_financials_cash_equivalents__title,
      }),
      actual: intl.formatMessage({
        id: ETranslations.market_stock_financials_actual__title,
      }),
      estimate: intl.formatMessage({
        id: ETranslations.market_stock_financials_estimate__title,
      }),
      partial: intl.formatMessage({
        id: ETranslations.market_stock_financials_partial_data__msg,
      }),
      simplified: intl.formatMessage({
        id: ETranslations.market_stock_financials_simplified_subtotals__desc,
      }),
      next: intl.formatMessage({
        id: ETranslations.market_stock_financials_next__title,
      }),
      expensesAndAdjustments: intl.formatMessage({
        id: ETranslations.market_stock_financials_expenses_adjustments__title,
      }),
    }),
    [intl],
  );
}
