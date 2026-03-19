export enum ERiskSeverity {
  Critical = 'critical',
  Warning = 'warning',
  Info = 'info',
}

export type IRiskSignal = {
  key: string;
  severity: ERiskSeverity;
  title: string;
  description?: string;
};

export enum ERiskCheckCategory {
  SiteSecurity = 'siteSecurity',
  TransactionSimulation = 'transactionSimulation',
  TransactionAnalysis = 'transactionAnalysis',

  AddressRisk = 'addressRisk',
}

export type IRiskCheckItem = {
  category: ERiskCheckCategory;
  label: string;
  passed: boolean;
  signals: IRiskSignal[];
  highestSeverity?: ERiskSeverity;
};

export type IRiskDetectionCardProps = {
  checks: IRiskCheckItem[];
};
