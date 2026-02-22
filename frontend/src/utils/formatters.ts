/**
 * Shared formatting utilities
 * Extracted to eliminate duplication across DashboardPage, TransactionsPage, BudgetPlanningPage, BudgetWizard
 */

/**
 * Format amount as Swiss Franc (CHF) currency
 * Previously duplicated 4 times across the codebase
 */
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format amount with decimal places
 */
export const formatAmountWithDecimals = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format large amounts in shortened form (e.g., 1000 → 1.0k)
 */
export const formatShortAmount = (amount: number): string => {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`;
  }
  return amount.toFixed(0);
};

/**
 * Format number as percentage (e.g., 12.5 → "12.5%")
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};
