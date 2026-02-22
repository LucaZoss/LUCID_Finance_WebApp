/**
 * Shared constants used across the application
 * Extracted to eliminate duplication
 */

// Month names (previously duplicated in DashboardPage, BudgetPlanningPage)
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_NAMES_SHORT = MONTH_NAMES.map((m) => m.substring(0, 3));

// Chart colors (previously in DashboardPage)
export const CHART_COLORS = {
  income: '#22c55e',
  expenses: '#ef4444',
  savings: '#3b82f6',
  remaining: '#f59e0b',
  positive: '#22c55e',
  negative: '#ef4444',
} as const;

// Transaction types
export const TRANSACTION_TYPES = ['Income', 'Expenses', 'Savings'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
