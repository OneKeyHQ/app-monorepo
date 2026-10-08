// cspell:ignore financials
export type IStockFinancialPeriod = 'annual' | 'quarter';

export interface IStockFinancialReportingPeriod {
  date: string;
  fiscalYear: string;
  fiscalPeriod?: string;
  reportedCurrency?: string;
}

export interface IStockFinancialPerformance extends IStockFinancialReportingPeriod {
  revenue: number | null;
  netIncome: number | null;
  netMarginPercent: number | null;
}

export interface IStockFinancialConversion extends IStockFinancialReportingPeriod {
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  operatingIncome: number | null;
  nonOperatingIncomeExpenses: number | null;
  incomeTaxExpense: number | null;
  taxesAndOther: number | null;
  netIncome: number | null;
}

export interface IStockFinancialDebt extends IStockFinancialReportingPeriod {
  totalDebt: number | null;
  freeCashFlow: number | null;
  cashAndCashEquivalents: number | null;
}

export interface IStockFinancialEarning extends IStockFinancialReportingPeriod {
  actual: number | null;
  estimate: number | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  numAnalysts: number | null;
}

export interface IStockFinancials {
  stockId: string;
  period: IStockFinancialPeriod;
  currency?: string;
  performance: IStockFinancialPerformance[];
  revenueToProfitConversion?: IStockFinancialConversion;
  debtLevelAndCoverage: IStockFinancialDebt[];
  earnings: {
    items: IStockFinancialEarning[];
    nextEarningsDate?: string;
  };
  partial: boolean;
  unavailableSources: (
    | 'income_statement'
    | 'balance_sheet_statement'
    | 'cash_flow_statement'
    | 'analyst_estimates'
    | 'earnings'
  )[];
  updatedAt: string;
}
