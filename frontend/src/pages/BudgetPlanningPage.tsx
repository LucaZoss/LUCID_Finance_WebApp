import { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, Save, DollarSign, FolderPlus, Edit2, X, Sparkles } from 'lucide-react';
import type { BudgetPlan, CategoryInfo } from '../types';
import * as api from '../api';
import BudgetWizard from '../components/BudgetWizard';
import { MONTH_NAMES_SHORT } from '../constants';
import { formatAmount } from '../utils/formatters';
import { getApiErrorMessage } from '../utils/errors';
import { Button, Card, Select } from '../components/ui';

const months = MONTH_NAMES_SHORT;

interface BudgetRow {
  type: string;
  category: string;
  sub_type: string | null;
  yearlyAmount: number;
  monthlyAmounts: Record<number, number>;
  budgetIds: number[]; // Store all budget IDs for this row (yearly + monthly)
}

export default function BudgetPlanningPage() {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Organized budget data
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);

  // Selection for bulk delete
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // New budget form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBudget, setNewBudget] = useState({
    type: 'Expenses',
    category: '',
    sub_type: null as string | null,
    amount: 0,
    isMonthly: false,
  });

  // Category management
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [allCategories, setAllCategories] = useState<api.Category[]>([]);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'Expenses',
  });
  const [editingCategory, setEditingCategory] = useState<api.Category | null>(null);

  // Budget Wizard
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadBudgets();
  }, [selectedYear]);

  const loadInitialData = async () => {
    try {
      const categoriesData = await api.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadAllCategories = async () => {
    try {
      const allCats = await api.getAllCategories();
      setAllCategories(allCats);
    } catch (error) {
      console.error('Failed to load all categories:', error);
    }
  };

  const handleOpenCategoryModal = () => {
    loadAllCategories();
    setShowCategoryModal(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      await api.createCategory({
        name: newCategory.name.trim(),
        type: newCategory.type,
      });

      setNewCategory({ name: '', type: 'Expenses' });
      await loadAllCategories();
      await loadInitialData(); // Reload categories for dropdowns
    } catch (error: unknown) {
      console.error('Failed to create category:', error);
      alert(getApiErrorMessage(error) || 'Failed to create category');
    }
  };

  const handleEditCategory = (category: api.Category) => {
    setEditingCategory(category);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      await api.updateCategory(editingCategory.id, {
        name: editingCategory.name,
        type: editingCategory.type,
      });

      setEditingCategory(null);
      await loadAllCategories();
      await loadInitialData();
    } catch (error: unknown) {
      console.error('Failed to update category:', error);
      alert(getApiErrorMessage(error) || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category? It will be deactivated if used in transactions or budgets.')) {
      return;
    }

    try {
      const result = await api.deleteCategory(categoryId);
      alert(result.message);
      await loadAllCategories();
      await loadInitialData();
    } catch (error: unknown) {
      console.error('Failed to delete category:', error);
      alert(getApiErrorMessage(error) || 'Failed to delete category');
    }
  };

  const handleToggleCategoryStatus = async (category: api.Category) => {
    try {
      await api.updateCategory(category.id, {
        is_active: !category.is_active,
      });
      await loadAllCategories();
      await loadInitialData();
    } catch (error: unknown) {
      console.error('Failed to toggle category status:', error);
      alert(getApiErrorMessage(error) || 'Failed to update category');
    }
  };

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets(selectedYear);
      organizeBudgets(data);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeBudgets = (budgetData: BudgetPlan[]) => {
    const rowMap = new Map<string, BudgetRow>();

    budgetData.forEach((budget) => {
      const key = `${budget.type}-${budget.category}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          type: budget.type,
          category: budget.category,
          sub_type: budget.sub_type || null,
          yearlyAmount: 0,
          monthlyAmounts: {},
          budgetIds: [],
        });
      }

      const row = rowMap.get(key)!;
      row.budgetIds.push(budget.id);
      // Update sub_type from yearly budget (even if null)
      if (budget.month === null) {
        row.sub_type = budget.sub_type || null;
        row.yearlyAmount = budget.amount;
      } else {
        row.monthlyAmounts[budget.month] = budget.amount;
      }
    });

    setBudgetRows(Array.from(rowMap.values()));
  };

  const getCategoriesForType = (type: string): string[] => {
    const categoryInfo = categories.find((c) => c.type === type);
    return categoryInfo?.categories || [];
  };

  const handleSaveBudget = async (
    type: string,
    category: string,
    amount: number,
    month?: number,
    sub_type?: string | null
  ) => {
    // Validate amount
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount (0 or greater)');
      return;
    }

    setSaving(true);
    try {
      await api.createBudget({
        type,
        category,
        sub_type: sub_type || null,
        year: selectedYear,
        month: month || null,
        amount,
      });
      await loadBudgets();
    } catch (error: unknown) {
      console.error('Failed to save budget:', error);
      const errorMsg = getApiErrorMessage(error) || 'Failed to save budget. Please try again.';
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBudget = async () => {
    if (!newBudget.category || newBudget.amount <= 0) {
      alert('Please select a category and enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      if (newBudget.isMonthly) {
        // Create monthly budgets for all 12 months
        for (let month = 1; month <= 12; month++) {
          await api.createBudget({
            type: newBudget.type,
            category: newBudget.category,
            sub_type: newBudget.sub_type,
            year: selectedYear,
            month,
            amount: newBudget.amount,
          });
        }
      } else {
        // Create yearly budget
        await api.createBudget({
          type: newBudget.type,
          category: newBudget.category,
          sub_type: newBudget.sub_type,
          year: selectedYear,
          month: null,
          amount: newBudget.amount,
        });
      }

      setShowAddForm(false);
      setNewBudget({ type: 'Expenses', category: '', sub_type: null, amount: 0, isMonthly: false });
      await loadBudgets();
    } catch (error) {
      console.error('Failed to add budget:', error);
      alert('Failed to add budget');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;

    const budgetIdsToDelete: number[] = [];
    budgetRows.forEach((row) => {
      const rowKey = `${row.type}-${row.category}`;
      if (selectedRows.has(rowKey)) {
        budgetIdsToDelete.push(...row.budgetIds);
      }
    });

    if (!confirm(`Are you sure you want to delete ${selectedRows.size} budget line(s)? This will remove all associated yearly and monthly budgets.`)) {
      return;
    }

    try {
      await api.bulkDeleteBudgets(budgetIdsToDelete);
      setSelectedRows(new Set());
      await loadBudgets();
    } catch (error) {
      console.error('Failed to bulk delete budgets:', error);
      alert('Failed to delete selected budgets');
    }
  };

  const toggleRowSelection = (type: string, category: string) => {
    const rowKey = `${type}-${category}`;
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowKey)) {
      newSelection.delete(rowKey);
    } else {
      newSelection.add(rowKey);
    }
    setSelectedRows(newSelection);
  };

  const toggleAllInType = (_type: string, rows: BudgetRow[]) => {
    const newSelection = new Set(selectedRows);
    const allSelected = rows.every((row) => selectedRows.has(`${row.type}-${row.category}`));

    if (allSelected) {
      // Deselect all in this type
      rows.forEach((row) => newSelection.delete(`${row.type}-${row.category}`));
    } else {
      // Select all in this type
      rows.forEach((row) => newSelection.add(`${row.type}-${row.category}`));
    }

    setSelectedRows(newSelection);
  };

  const getTypeColor = (type: string, sub_type: string | null) => {
    if (type === 'Income') {
      return 'border-l-green-500 bg-green-50';
    } else if (type === 'Expenses') {
      if (sub_type === 'Essentials' || sub_type === 'Needs') {
        return 'border-l-blue-500 bg-blue-50';
      } else if (sub_type === 'Wants') {
        return 'border-l-purple-500 bg-purple-50';
      } else {
        return 'border-l-red-500 bg-red-50';
      }
    } else if (type === 'Savings') {
      return 'border-l-yellow-500 bg-yellow-50';
    }
    return 'border-l-gray-500 bg-gray-50';
  };

  const getGroupHeaderColor = (groupName: string) => {
    if (groupName === 'Income') {
      return 'bg-green-50';
    } else if (groupName === 'Expenses - Essentials & Needs') {
      return 'bg-blue-50';
    } else if (groupName === 'Expenses - Wants') {
      return 'bg-purple-50';
    } else if (groupName === 'Expenses - Other') {
      return 'bg-red-50';
    } else if (groupName === 'Savings') {
      return 'bg-yellow-50';
    }
    return 'bg-gray-50';
  };

  const expenseRows = budgetRows.filter((r) => r.type === 'Expenses');

  // Combine Essentials and Needs, ensure Housing and Health Insurance are first
  const essentialsAndNeeds = expenseRows.filter(
    (r) => r.sub_type === 'Essentials' || r.sub_type === 'Needs'
  ).sort((a, b) => {
    // Housing first, Health Insurance second, then alphabetical
    if (a.category === 'Housing') return -1;
    if (b.category === 'Housing') return 1;
    if (a.category === 'Health Insurance') return -1;
    if (b.category === 'Health Insurance') return 1;
    return a.category.localeCompare(b.category);
  });

  const groupedRows = {
    Income: budgetRows.filter((r) => r.type === 'Income'),
    'Expenses - Essentials & Needs': essentialsAndNeeds,
    'Expenses - Wants': expenseRows.filter((r) => r.sub_type === 'Wants'),
    'Expenses - Other': expenseRows.filter((r) => !r.sub_type || (r.sub_type !== 'Essentials' && r.sub_type !== 'Needs' && r.sub_type !== 'Wants')),
    Savings: budgetRows.filter((r) => r.type === 'Savings'),
  };

  // Calculate summary totals
  const totalIncome = groupedRows.Income.reduce((sum, row) => sum + row.yearlyAmount, 0);
  const totalEssentials = expenseRows.filter((r) => r.sub_type === 'Essentials').reduce((sum, row) => sum + row.yearlyAmount, 0);
  const totalNeeds = expenseRows.filter((r) => r.sub_type === 'Needs').reduce((sum, row) => sum + row.yearlyAmount, 0);
  const totalWants = expenseRows.filter((r) => r.sub_type === 'Wants').reduce((sum, row) => sum + row.yearlyAmount, 0);
  const totalExpenses = expenseRows.reduce((sum, row) => sum + row.yearlyAmount, 0);
  const totalSavings = groupedRows.Savings.reduce((sum, row) => sum + row.yearlyAmount, 0);
  const netAmount = totalIncome - totalExpenses - totalSavings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Calculator className="w-6 h-6 mr-2 text-blue-600" />
            Budget Planning
          </h1>
          <p className="text-gray-500 mt-1">
            Set your yearly and monthly budgets for each category
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 1).map(
              (y) => ({ value: y, label: String(y) })
            )}
            className="text-sm"
          />

          {selectedRows.size > 0 && (
            <Button
              variant="danger"
              onClick={handleBulkDelete}
              className="mt-5 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedRows.size})
            </Button>
          )}

          <Button
            onClick={handleOpenCategoryModal}
            className="mt-5 flex items-center bg-purple-600 hover:bg-purple-700"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Manage Categories
          </Button>

          <Button
            onClick={() => setShowWizard(true)}
            className="mt-5 flex items-center bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Budget Wizard
          </Button>

          <Button
            onClick={() => setShowAddForm(true)}
            className="mt-5 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Budget
          </Button>
        </div>
      </div>

      {/* Budget Summary */}
      <Card className="border-2 border-gray-300 bg-gradient-to-r from-gray-50 to-blue-50" shadow="md">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
          Budget Summary - {selectedYear}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Income */}
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-green-700 mb-1">Income Budget</div>
            <div className="text-2xl font-bold text-green-900">{formatAmount(totalIncome)}</div>
            <div className="text-xs text-green-600 mt-1">100%</div>
          </div>

          {/* Total Expenses */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-red-700 mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-red-900">{formatAmount(totalExpenses)}</div>
            {totalIncome > 0 && (
              <div className="text-xs text-red-600 mt-1">
                {((totalExpenses / totalIncome) * 100).toFixed(1)}% of income
              </div>
            )}
          </div>

          {/* Essentials & Needs (Grouped) */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-700 mb-1">Essentials & Needs</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatAmount(totalEssentials + totalNeeds)}
            </div>
            {totalIncome > 0 && (
              <div className="text-xs text-blue-600 mt-1">
                {(((totalEssentials + totalNeeds) / totalIncome) * 100).toFixed(1)}% of income
              </div>
            )}
          </div>

          {/* Wants */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-purple-700 mb-1">Wants</div>
            <div className="text-2xl font-bold text-purple-900">{formatAmount(totalWants)}</div>
            {totalIncome > 0 && (
              <div className="text-xs text-purple-600 mt-1">
                {((totalWants / totalIncome) * 100).toFixed(1)}% of income
              </div>
            )}
          </div>

          {/* Savings */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-yellow-700 mb-1">Savings</div>
            <div className="text-2xl font-bold text-yellow-900">{formatAmount(totalSavings)}</div>
            {totalIncome > 0 && (
              <div className="text-xs text-yellow-600 mt-1">
                {((totalSavings / totalIncome) * 100).toFixed(1)}% of income
              </div>
            )}
          </div>

          {/* Surplus/Deficit */}
          <div className={`border-2 rounded-lg p-4 ${netAmount >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-orange-50 border-orange-300'}`}>
            <div className={`text-sm font-semibold mb-1 ${netAmount >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
              {netAmount >= 0 ? 'Surplus' : 'Deficit'}
            </div>
            <div className={`text-2xl font-bold ${netAmount >= 0 ? 'text-emerald-900' : 'text-orange-900'}`}>
              {formatAmount(Math.abs(netAmount))}
            </div>
            {totalIncome > 0 && (
              <div className={`text-xs mt-1 ${netAmount >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {((Math.abs(netAmount) / totalIncome) * 100).toFixed(1)}% of income
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Add Budget Form */}
      {showAddForm && (
        <Card className="border border-gray-200" shadow="sm">
          <h3 className="text-lg font-semibold mb-4">Add New Budget</h3>
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newBudget.type}
                onChange={(e) =>
                  setNewBudget({
                    ...newBudget,
                    type: e.target.value,
                    category: getCategoriesForType(e.target.value)[0] || '',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Income">Income</option>
                <option value="Expenses">Expenses</option>
                <option value="Savings">Savings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newBudget.category}
                onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select category</option>
                {getCategoriesForType(newBudget.type).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Type</label>
              <select
                value={newBudget.sub_type || ''}
                onChange={(e) => setNewBudget({ ...newBudget, sub_type: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">None</option>
                <option value="Essentials">Essentials</option>
                <option value="Needs">Needs</option>
                <option value="Wants">Wants</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (CHF) - {newBudget.isMonthly ? 'Monthly' : 'Yearly Total'}
              </label>
              <input
                type="number"
                value={newBudget.amount || ''}
                onChange={(e) => setNewBudget({ ...newBudget, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder={newBudget.isMonthly ? "e.g., 1500" : "e.g., 12000"}
              />
              {!newBudget.isMonthly && newBudget.amount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  → {(newBudget.amount / 12).toFixed(2)} CHF per month
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Budget Type</label>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex items-start cursor-pointer p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  checked={!newBudget.isMonthly}
                  onChange={() => setNewBudget({ ...newBudget, isMonthly: false })}
                  className="mr-3 mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900">Yearly Total</span>
                  <p className="text-xs text-gray-500">Enter total yearly amount (e.g., 12,000 for Travel)</p>
                  <p className="text-xs text-gray-500">→ Automatically divided into 12 equal monthly budgets</p>
                </div>
              </label>
              <label className="flex items-start cursor-pointer p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  checked={newBudget.isMonthly}
                  onChange={() => setNewBudget({ ...newBudget, isMonthly: true })}
                  className="mr-3 mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900">Monthly Recurring</span>
                  <p className="text-xs text-gray-500">Enter monthly amount (e.g., 1,500 for Groceries)</p>
                  <p className="text-xs text-gray-500">→ Same amount set for all 12 months</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleAddBudget}
              isLoading={saving}
              className="flex items-center"
            >
              {!saving && <Save className="w-4 h-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Budget'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Budget Tables by Type */}
      {loading ? (
        <Card className="border border-gray-200 text-center" shadow="sm" padding="lg">
          <p className="text-gray-500">Loading budgets...</p>
        </Card>
      ) : (
        Object.entries(groupedRows).map(([groupName, rows]) => {
          // Skip empty groups
          if (rows.length === 0) return null;

          return (
            <Card key={groupName} className="border border-gray-200 overflow-hidden" shadow="sm" padding="none">
              <div className={`px-6 py-4 border-b border-gray-200 ${getGroupHeaderColor(groupName)}`}>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  {groupName}
                </h2>
              </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-center sticky left-0 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every((row) => selectedRows.has(`${row.type}-${row.category}`))}
                          onChange={() => toggleAllInType(rows[0]?.type || 'Expenses', rows)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Yearly
                      </th>
                      {months.map((month, i) => (
                        <th
                          key={i}
                          className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                        >
                          {month}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, index) => (
                      <tr key={index} className={`hover:bg-gray-50 border-l-4 ${getTypeColor(row.type, row.sub_type)}`}>
                        <td className="px-2 py-3 text-center sticky left-0 bg-white">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(`${row.type}-${row.category}`)}
                            onChange={() => toggleRowSelection(row.type, row.category)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {row.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={row.yearlyAmount || ''}
                            onBlur={(e) => {
                              const inputValue = e.target.value.trim();
                              // If empty, treat as 0
                              const value = inputValue === '' ? 0 : Number(inputValue);
                              // Only save if value changed and is valid
                              if (!isNaN(value) && value !== row.yearlyAmount) {
                                handleSaveBudget(row.type, row.category, value, undefined, row.sub_type);
                              }
                            }}
                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </td>
                        {months.map((_, monthIndex) => (
                          <td key={monthIndex} className="px-3 py-3 text-sm text-gray-900 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={row.monthlyAmounts[monthIndex + 1] || ''}
                              onBlur={(e) => {
                                const inputValue = e.target.value.trim();
                                // If empty, treat as 0
                                const value = inputValue === '' ? 0 : Number(inputValue);
                                const currentValue = row.monthlyAmounts[monthIndex + 1] || 0;
                                // Only save if value changed and is valid
                                if (!isNaN(value) && value !== currentValue) {
                                  handleSaveBudget(row.type, row.category, value, monthIndex + 1, row.sub_type);
                                }
                              }}
                              className="w-20 px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-medium">
                    <tr>
                      <td className="px-2 py-3 sticky left-0 bg-gray-100"></td>
                      <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatAmount(rows.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0))}
                      </td>
                      {months.map((_, monthIndex) => (
                        <td key={monthIndex} className="px-3 py-3 text-sm text-gray-900 text-right">
                          {formatAmount(
                            rows.reduce((sum, r) => sum + (r.monthlyAmounts[monthIndex + 1] || 0), 0)
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          );
        })
      )}

      {/* Summary Card */}
      <Card className="border border-gray-200" shadow="sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Summary for {selectedYear}</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Total Income Budget</p>
            <p className="text-2xl font-bold text-green-700">
              CHF {formatAmount(groupedRows.Income.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600 font-medium">Total Expenses Budget</p>
            <p className="text-2xl font-bold text-red-700">
              CHF {formatAmount(
                expenseRows.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0)
              )}
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-600 font-medium">Total Savings Budget</p>
            <p className="text-2xl font-bold text-yellow-700">
              CHF {formatAmount(groupedRows.Savings.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">Net (Income - Expenses - Savings)</p>
            <p className="text-2xl font-bold text-purple-700">
              CHF{' '}
              {formatAmount(
                groupedRows.Income.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0) -
                  expenseRows.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0) -
                  groupedRows.Savings.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0)
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage Categories</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Add New Category */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Add New Category</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newCategory.type}
                      onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Income">Income</option>
                      <option value="Expenses">Expenses</option>
                      <option value="Savings">Savings</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category Name</label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="e.g., Entertainment"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleCreateCategory}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Add Category
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Categories */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Existing Categories</h3>
                {['Income', 'Expenses', 'Savings'].map((type) => {
                  const typeCats = allCategories.filter((cat) => cat.type === type);
                  if (typeCats.length === 0) return null;

                  return (
                    <div key={type} className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">{type}</h4>
                      <div className="space-y-2">
                        {typeCats.map((cat) => (
                          <div
                            key={cat.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              cat.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
                            }`}
                          >
                            {editingCategory?.id === cat.id ? (
                              <>
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingCategory.name}
                                    onChange={(e) =>
                                      setEditingCategory({ ...editingCategory, name: e.target.value })
                                    }
                                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <select
                                    value={editingCategory.type}
                                    onChange={(e) =>
                                      setEditingCategory({ ...editingCategory, type: e.target.value })
                                    }
                                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="Income">Income</option>
                                    <option value="Expenses">Expenses</option>
                                    <option value="Savings">Savings</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <button
                                    onClick={handleUpdateCategory}
                                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingCategory(null)}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-medium ${cat.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {cat.name}
                                  </span>
                                  {!cat.is_active && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleCategoryStatus(cat)}
                                    className={`text-xs px-3 py-1 rounded ${
                                      cat.is_active
                                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                    }`}
                                  >
                                    {cat.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => handleEditCategory(cat)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Wizard */}
      {showWizard && (
        <BudgetWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            loadBudgets();
            setShowWizard(false);
          }}
          selectedYear={selectedYear}
        />
      )}

    </div>
  );
}
