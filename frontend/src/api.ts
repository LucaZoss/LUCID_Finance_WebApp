import axios from 'axios';
import type { Transaction, BudgetPlan, CategoryInfo, DashboardSummary, MonthlyTrend } from './types';

const api = axios.create({
  baseURL: '/api',
});

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('last_activity');

      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth token management
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Auth
export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  is_admin: boolean;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
};

export interface UserCreate {
  username: string;
  password: string;
  full_name?: string;
  is_admin: boolean;
}

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export const createUser = async (userData: UserCreate): Promise<User> => {
  const { data } = await api.post('/auth/users', userData);
  return data;
};

export const getUsers = async (): Promise<User[]> => {
  const { data } = await api.get('/auth/users');
  return data;
};

// Transactions
export const getTransactions = async (params?: {
  year?: number;
  month?: number;
  type?: string;
  category?: string;
  amount_min?: number;
  amount_max?: number;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> => {
  const { data } = await api.get('/transactions', { params });
  return data;
};

export const updateTransaction = async (
  id: number,
  update: { type?: string; category?: string }
): Promise<Transaction> => {
  const { data } = await api.patch(`/transactions/${id}`, update);
  return data;
};

export const bulkUpdateTransactions = async (
  transactionIds: number[],
  update: { type?: string; category?: string; sub_type?: string | null }
): Promise<{ updated_count: number; message: string }> => {
  const { data } = await api.patch('/transactions/bulk', {
    transaction_ids: transactionIds,
    ...update,
  });
  return data;
};

export const deleteTransaction = async (id: number): Promise<void> => {
  await api.delete(`/transactions/${id}`);
};

// Upload
export const uploadFiles = async (
  ubsFile?: File,
  ccFile?: File
): Promise<{ message: string; stats: unknown }> => {
  const formData = new FormData();
  if (ubsFile) formData.append('ubs_file', ubsFile);
  if (ccFile) formData.append('cc_file', ccFile);

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// Budgets
export const getBudgets = async (year?: number): Promise<BudgetPlan[]> => {
  const { data } = await api.get('/budgets', { params: year ? { year } : {} });
  return data;
};

export const createBudget = async (budget: {
  type: string;
  category: string;
  sub_type?: string | null;
  year: number;
  month?: number | null;
  amount: number;
}): Promise<BudgetPlan> => {
  const { data } = await api.post('/budgets', budget);
  return data;
};

export const deleteBudget = async (id: number): Promise<void> => {
  await api.delete(`/budgets/${id}`);
};

export const bulkDeleteBudgets = async (budgetIds: number[]): Promise<{ message: string; count: number }> => {
  const { data } = await api.post('/budgets/bulk-delete', budgetIds);
  return data;
};

// Categories
export interface Category {
  id: number;
  name: string;
  type: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  type: string;
  display_order?: number;
}

export interface CategoryUpdate {
  name?: string;
  type?: string;
  is_active?: boolean;
  display_order?: number;
}

export const getCategories = async (): Promise<CategoryInfo[]> => {
  const { data } = await api.get('/categories');
  return data;
};

export const getAllCategories = async (): Promise<Category[]> => {
  const { data } = await api.get('/categories/all');
  return data;
};

export const createCategory = async (category: CategoryCreate): Promise<Category> => {
  const { data } = await api.post('/categories', category);
  return data;
};

export const updateCategory = async (id: number, update: CategoryUpdate): Promise<Category> => {
  const { data } = await api.patch(`/categories/${id}`, update);
  return data;
};

export const deleteCategory = async (id: number): Promise<{ message: string }> => {
  const { data } = await api.delete(`/categories/${id}`);
  return data;
};

export const getTypes = async (): Promise<string[]> => {
  const { data } = await api.get('/types');
  return data;
};

// Dashboard
export const getDashboardSummary = async (
  year: number,
  month?: number
): Promise<DashboardSummary> => {
  const { data } = await api.get('/dashboard/summary', {
    params: { year, ...(month && { month }) },
  });
  return data;
};

export const getMonthlyTrend = async (year: number, categories?: string[]): Promise<MonthlyTrend[]> => {
  const { data } = await api.get('/dashboard/monthly-trend', {
    params: {
      year,
      ...(categories && categories.length > 0 && { categories: categories.join(',') })
    }
  });
  return data;
};

export const getAvailableYears = async (): Promise<number[]> => {
  const { data } = await api.get('/years');
  return data;
};

// Categorization Rules
export interface CategorizationRule {
  id: number;
  pattern: string;
  case_sensitive: boolean;
  amount_operator: string | null;
  amount_value: number | null;
  type: string;
  category: string;
  priority: number;
  is_active: boolean;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  pattern: string;
  case_sensitive: boolean;
  amount_operator?: string | null;
  amount_value?: number | null;
  type: string;
  category: string;
  priority: number;
}

export interface RuleUpdate {
  pattern?: string;
  case_sensitive?: boolean;
  amount_operator?: string | null;
  amount_value?: number | null;
  type?: string;
  category?: string;
  priority?: number;
  is_active?: boolean;
}

export const getRules = async (isActive?: boolean): Promise<CategorizationRule[]> => {
  const { data } = await api.get('/rules', { params: isActive !== undefined ? { is_active: isActive } : {} });
  return data;
};

export const createRule = async (rule: RuleCreate): Promise<CategorizationRule> => {
  const { data } = await api.post('/rules', rule);
  return data;
};

export const updateRule = async (id: number, update: RuleUpdate): Promise<CategorizationRule> => {
  const { data } = await api.patch(`/rules/${id}`, update);
  return data;
};

export const deleteRule = async (id: number): Promise<void> => {
  await api.delete(`/rules/${id}`);
};

export const applyRulesToTransactions = async (): Promise<{ message: string; updated_count: number; total_transactions: number; active_rules: number }> => {
  const { data } = await api.post('/rules/apply');
  return data;
};

// Export
export const downloadExcel = async (year: number, month?: number): Promise<void> => {
  const response = await api.get('/export/excel', {
    params: { year, ...(month && { month }) },
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;

  const periodText = month
    ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]}_${year}`
    : `${year}`;
  link.setAttribute('download', `LUCID_Finance_${periodText}.xlsx`);

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
