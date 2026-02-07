import { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, Save, DollarSign, FolderPlus, Edit2, X, Sparkles, TrendingUp } from 'lucide-react';
import type { BudgetPlan, CategoryInfo } from '../types';
import * as api from '../api';

interface BudgetRow {
  type: string;
  category: string;
  yearlyAmount: number;
  monthlyAmounts: Record<number, number>;
  budgetIds: number[]; // Store all budget IDs for this row (yearly + monthly)
}

export default function BudgetPlanningPage() {
  const [budgets, setBudgets] = useState<BudgetPlan[]>([]);
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

  // Budget Helper Tool (Beta)
  const [showBudgetHelper, setShowBudgetHelper] = useState(false);
  const [helperIncome, setHelperIncome] = useState<number>(0);
  const [helperAllocations, setHelperAllocations] = useState({
    housing: 0,
    healthInsurance: 0,
    groceries: 0,
    tax: 0,
    trading: 0,
  });

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

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
    } catch (error: any) {
      console.error('Failed to create category:', error);
      alert(error.response?.data?.detail || 'Failed to create category');
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
    } catch (error: any) {
      console.error('Failed to update category:', error);
      alert(error.response?.data?.detail || 'Failed to update category');
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
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      alert(error.response?.data?.detail || 'Failed to delete category');
    }
  };

  const handleToggleCategoryStatus = async (category: api.Category) => {
    try {
      await api.updateCategory(category.id, {
        is_active: !category.is_active,
      });
      await loadAllCategories();
      await loadInitialData();
    } catch (error: any) {
      console.error('Failed to toggle category status:', error);
      alert(error.response?.data?.detail || 'Failed to update category');
    }
  };

  // Budget Helper Functions
  const calculateHelperPercentage = (amount: number): number => {
    if (helperIncome <= 0) return 0;
    return (amount / helperIncome) * 100;
  };

  const calculateHelperRemaining = (): number => {
    const total = Object.values(helperAllocations).reduce((sum, val) => sum + val, 0);
    return helperIncome - total;
  };

  const handleHelperAllocationChange = (category: keyof typeof helperAllocations, value: number) => {
    setHelperAllocations({
      ...helperAllocations,
      [category]: value >= 0 ? value : 0,
    });
  };

  const handleApplyHelperToMonthlyBudget = async () => {
    if (helperIncome <= 0) {
      alert('Please enter your monthly income first');
      return;
    }

    const remaining = calculateHelperRemaining();
    if (remaining < 0) {
      alert(`Your allocations exceed your income by CHF ${Math.abs(remaining).toFixed(2)}. Please adjust.`);
      return;
    }

    if (!confirm('This will create monthly budgets for the selected categories. Continue?')) {
      return;
    }

    try {
      setSaving(true);

      // Map helper categories to actual budget categories
      const categoryMapping = {
        housing: 'Housing',
        healthInsurance: 'Health Insurance',
        groceries: 'Groceries',
        tax: 'Tax',
        trading: 'Stock Portofolio', // or could be 'Savings'
      };

      // Create budgets for non-zero allocations
      for (const [key, category] of Object.entries(categoryMapping)) {
        const amount = helperAllocations[key as keyof typeof helperAllocations];
        if (amount > 0) {
          const type = key === 'trading' ? 'Savings' : 'Expenses';
          await api.createBudget({
            type,
            category,
            year: selectedYear,
            month: null, // Yearly budget (could be changed to monthly)
            amount: amount * 12, // Convert monthly to yearly
          });
        }
      }

      alert('Budget allocations applied successfully!');
      setShowBudgetHelper(false);
      await loadBudgets();
    } catch (error: any) {
      console.error('Failed to apply budget allocations:', error);
      alert(error.response?.data?.detail || 'Failed to apply budget allocations');
    } finally {
      setSaving(false);
    }
  };

  const resetBudgetHelper = () => {
    setHelperIncome(0);
    setHelperAllocations({
      housing: 0,
      healthInsurance: 0,
      groceries: 0,
      tax: 0,
      trading: 0,
    });
  };

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets(selectedYear);
      setBudgets(data);
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
          yearlyAmount: 0,
          monthlyAmounts: {},
          budgetIds: [],
        });
      }

      const row = rowMap.get(key)!;
      row.budgetIds.push(budget.id);
      if (budget.month === null) {
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
    month?: number
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
        year: selectedYear,
        month: month || null,
        amount,
      });
      await loadBudgets();
    } catch (error: any) {
      console.error('Failed to save budget:', error);
      const errorMsg = error?.response?.data?.detail || 'Failed to save budget. Please try again.';
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
          year: selectedYear,
          month: null,
          amount: newBudget.amount,
        });
      }

      setShowAddForm(false);
      setNewBudget({ type: 'Expenses', category: '', amount: 0, isMonthly: false });
      await loadBudgets();
    } catch (error) {
      console.error('Failed to add budget:', error);
      alert('Failed to add budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    try {
      await api.deleteBudget(budgetId);
      await loadBudgets();
    } catch (error) {
      console.error('Failed to delete budget:', error);
      alert('Failed to delete budget');
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

  const toggleAllInType = (type: string, rows: BudgetRow[]) => {
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Income':
        return 'border-l-green-500 bg-green-50';
      case 'Expenses':
        return 'border-l-red-500 bg-red-50';
      case 'Savings':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const groupedRows = {
    Income: budgetRows.filter((r) => r.type === 'Income'),
    Expenses: budgetRows.filter((r) => r.type === 'Expenses'),
    Savings: budgetRows.filter((r) => r.type === 'Savings'),
  };

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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 1).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {selectedRows.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="mt-5 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedRows.size})
            </button>
          )}

          <button
            onClick={handleOpenCategoryModal}
            className="mt-5 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Manage Categories
          </button>

          <button
            onClick={() => setShowBudgetHelper(true)}
            className="mt-5 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 flex items-center relative"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Budget Helper
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-white/20 rounded">BETA</span>
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Budget
          </button>
        </div>
      </div>

      {/* Add Budget Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Budget</h3>
          <div className="grid md:grid-cols-4 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (CHF)
              </label>
              <input
                type="number"
                value={newBudget.amount || ''}
                onChange={(e) => setNewBudget({ ...newBudget, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!newBudget.isMonthly}
                    onChange={() => setNewBudget({ ...newBudget, isMonthly: false })}
                    className="mr-2"
                  />
                  Yearly
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={newBudget.isMonthly}
                    onChange={() => setNewBudget({ ...newBudget, isMonthly: true })}
                    className="mr-2"
                  />
                  Monthly
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddBudget}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Budget'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Budget Tables by Type */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Loading budgets...
        </div>
      ) : (
        Object.entries(groupedRows).map(([type, rows]) => (
          <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div
              className={`px-6 py-4 border-b border-gray-200 ${
                type === 'Income'
                  ? 'bg-green-50'
                  : type === 'Expenses'
                  ? 'bg-red-50'
                  : 'bg-blue-50'
              }`}
            >
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                {type}
              </h2>
            </div>

            {rows.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No budgets set for {type}. Click "Add Budget" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-center sticky left-0 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every((row) => selectedRows.has(`${row.type}-${row.category}`))}
                          onChange={() => toggleAllInType(type, rows)}
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
                      <tr key={index} className={`hover:bg-gray-50 border-l-4 ${getTypeColor(row.type)}`}>
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
                                handleSaveBudget(row.type, row.category, value);
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
                                  handleSaveBudget(row.type, row.category, value, monthIndex + 1);
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
            )}
          </div>
        ))
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
              CHF {formatAmount(groupedRows.Expenses.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Total Savings Budget</p>
            <p className="text-2xl font-bold text-blue-700">
              CHF {formatAmount(groupedRows.Savings.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">Net (Income - Expenses - Savings)</p>
            <p className="text-2xl font-bold text-purple-700">
              CHF{' '}
              {formatAmount(
                groupedRows.Income.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0) -
                  groupedRows.Expenses.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0) -
                  groupedRows.Savings.reduce((sum, r) => sum + (r.yearlyAmount || 0), 0)
              )}
            </p>
          </div>
        </div>
      </div>

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

      {/* Budget Helper Modal (BETA) */}
      {showBudgetHelper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Budget Helper</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded">
                        BETA
                      </span>
                      <span className="text-xs text-gray-500">
                        Quickly allocate your monthly income
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowBudgetHelper(false);
                    resetBudgetHelper();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Monthly Income Input */}
              <div className="bg-gradient-to-r from-orange-50 to-pink-50 p-4 rounded-lg border border-orange-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Income (CHF)
                </label>
                <input
                  type="number"
                  value={helperIncome || ''}
                  onChange={(e) => setHelperIncome(parseFloat(e.target.value) || 0)}
                  placeholder="Enter your monthly income"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Allocation Inputs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Allocate Your Budget
                </h3>

                {/* Housing */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Housing (Rent)
                    </label>
                    <span className="text-xs font-medium text-orange-600">
                      {calculateHelperPercentage(helperAllocations.housing).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    value={helperAllocations.housing || ''}
                    onChange={(e) => handleHelperAllocationChange('housing', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Health Insurance */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Health Insurance
                    </label>
                    <span className="text-xs font-medium text-orange-600">
                      {calculateHelperPercentage(helperAllocations.healthInsurance).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    value={helperAllocations.healthInsurance || ''}
                    onChange={(e) => handleHelperAllocationChange('healthInsurance', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Groceries */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Groceries
                    </label>
                    <span className="text-xs font-medium text-orange-600">
                      {calculateHelperPercentage(helperAllocations.groceries).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    value={helperAllocations.groceries || ''}
                    onChange={(e) => handleHelperAllocationChange('groceries', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Tax */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Tax
                    </label>
                    <span className="text-xs font-medium text-orange-600">
                      {calculateHelperPercentage(helperAllocations.tax).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    value={helperAllocations.tax || ''}
                    onChange={(e) => handleHelperAllocationChange('tax', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Trading/Wealth */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Trading/Wealth
                    </label>
                    <span className="text-xs font-medium text-orange-600">
                      {calculateHelperPercentage(helperAllocations.trading).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    value={helperAllocations.trading || ''}
                    onChange={(e) => handleHelperAllocationChange('trading', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Allocated:</span>
                    <span className="font-medium text-gray-900">
                      CHF {(Object.values(helperAllocations).reduce((sum, val) => sum + val, 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                    <span className="text-gray-600 font-medium">Remaining:</span>
                    <span className={`font-bold ${calculateHelperRemaining() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      CHF {calculateHelperRemaining().toFixed(2)}
                    </span>
                  </div>
                  {calculateHelperRemaining() < 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      ⚠️ Your allocations exceed your income!
                    </div>
                  )}
                  {helperIncome > 0 && calculateHelperRemaining() >= 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      You're using {((1 - calculateHelperRemaining() / helperIncome) * 100).toFixed(1)}% of your income
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
              <button
                onClick={resetBudgetHelper}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Reset
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBudgetHelper(false);
                    resetBudgetHelper();
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyHelperToMonthlyBudget}
                  disabled={helperIncome <= 0}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply to Budget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
