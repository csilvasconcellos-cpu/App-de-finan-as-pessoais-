
export enum EntryType {
  INCOME = 'INCOME',
  FIXED_EXPENSE = 'FIXED_EXPENSE',
  VARIABLE_EXPENSE = 'VARIABLE_EXPENSE'
}

export interface FinancialEntry {
  id: string;
  type: EntryType;
  description: string;
  amount: number;
  date: string; // ISO format
  isPaid: boolean;
  month: number; // 0-11
  year: number;
  
  // For recurring/replication logic
  originalId?: string; // Links replicated items to their source
  isReplicated?: boolean;
  
  // For installments
  isInstallment?: boolean;
  installmentNumber?: number;
  totalInstallments?: number;
  parentId?: string;
}

export interface MonthYear {
  month: number;
  year: number;
}
