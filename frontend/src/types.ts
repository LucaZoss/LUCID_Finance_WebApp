export interface Transaction {
  id: number;
  date: string;
  type: string;
  category: string;
  sub_type?: string | null;
  amount: number;
  description: string | null;
  source: string;
  month: number;
  year: number;
  source_file: string | null;
}

export interface BudgetPlan {
  id: number;
  type: string;
  category: string;
  sub_type?: string | null;
  year: number;
  month: number | null;
  amount: number;
}

export interface CategoryInfo {
  type: string;
  categories: string[];
}

export interface SummaryItem {
  type: string;
  category: string;
  budget: number;
  actual: number;
  remaining: number;
  percent_complete: number;
}

export interface DashboardSummary {
  year: number;
  month: number | null;
  income: SummaryItem[];
  expenses: SummaryItem[];
  savings: SummaryItem[];
  totals: {
    income: { actual: number; budget: number };
    expenses: { actual: number; budget: number };
    savings: { actual: number; budget: number };
    net: { actual: number; budget: number };
  };
  fixed_cost_ratio: number;
  previous_period: {
    year: number;
    month: number | null;
    net: number;
  };
  latest_transaction_date: string | null;
}

export interface MonthlyTrend {
  month: number;
  Income: number;
  Expenses: number;
  Savings: number;
  IncomeBudget: number;
  ExpensesBudget: number;
  SavingsBudget: number;
}
