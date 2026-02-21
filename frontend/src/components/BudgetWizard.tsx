import { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check, DollarSign, Home, Heart, ShoppingCart, Smile, PiggyBank, TrendingUp, Plus, Trash2 } from 'lucide-react';
import * as api from '../api';

interface WizardFormData {
  // Step 1
  annualIncome: number;

  // Step 2
  monthlyRent: number;

  // Step 3
  essentials: {
    healthInsurance: number;
    carLease: number;
    debtPayments: number;
    otherEssentials: Array<{ category: string; amount: number; isNew: boolean }>;
  };

  // Step 4
  needs: Array<{
    categoryId: number | null;
    categoryName: string;
    isNew: boolean;
    monthlyAmount: number;
  }>;

  // Step 5
  wants: Array<{
    categoryId: number | null;
    categoryName: string;
    isNew: boolean;
    monthlyAmount: number;
  }>;

  // Step 6
  annualSavingsGoal: number;
}

interface BudgetWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedYear: number;
}

const initialFormData: WizardFormData = {
  annualIncome: 0,
  monthlyRent: 0,
  essentials: {
    healthInsurance: 0,
    carLease: 0,
    debtPayments: 0,
    otherEssentials: [],
  },
  needs: [],
  wants: [],
  annualSavingsGoal: 0,
};

export default function BudgetWizard({ onClose, onSuccess, selectedYear }: BudgetWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<WizardFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for new category inputs
  const [showNewNeedInput, setShowNewNeedInput] = useState(false);
  const [newNeedName, setNewNeedName] = useState('');
  const [showNewWantInput, setShowNewWantInput] = useState(false);
  const [newWantName, setNewWantName] = useState('');

  const stepTitles = ['Income', 'Housing', 'Essentials', 'Needs', 'Wants', 'Savings', 'Review'];

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const allCats = await api.getAllCategories();
      setCategories(allCats.filter(c => c.is_active));
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Calculated values for Step 7
  const monthlyIncome = useMemo(() => formData.annualIncome / 12, [formData.annualIncome]);

  const fixedCosts = useMemo(() => {
    return formData.monthlyRent +
           formData.essentials.healthInsurance +
           formData.essentials.carLease +
           formData.essentials.debtPayments +
           formData.essentials.otherEssentials.reduce((sum, e) => sum + e.amount, 0);
  }, [formData.monthlyRent, formData.essentials]);

  const needsTotal = useMemo(() =>
    formData.needs.reduce((sum, n) => sum + n.monthlyAmount, 0),
    [formData.needs]
  );

  const wantsTotal = useMemo(() =>
    formData.wants.reduce((sum, w) => sum + w.monthlyAmount, 0),
    [formData.wants]
  );

  const monthlySavings = useMemo(() =>
    formData.annualSavingsGoal / 12,
    [formData.annualSavingsGoal]
  );

  const remainingBalance = useMemo(() =>
    monthlyIncome - fixedCosts - needsTotal - wantsTotal - monthlySavings,
    [monthlyIncome, fixedCosts, needsTotal, wantsTotal, monthlySavings]
  );

  // Format currency
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Validation functions
  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.annualIncome > 0;
      case 2:
        return formData.monthlyRent >= 0;
      case 3:
        return formData.essentials.otherEssentials.every(e =>
          e.amount >= 0 && (e.amount === 0 || e.category.trim() !== '')
        );
      case 4:
        return formData.needs.length > 0 &&
               formData.needs.every(n => n.monthlyAmount > 0);
      case 5:
        return formData.wants.every(w => w.monthlyAmount >= 0);
      case 6:
        return formData.annualSavingsGoal >= 0;
      case 7:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed(currentStep)) {
      setValidationErrors({ step: 'Please complete all required fields correctly' });
      return;
    }

    setValidationErrors({});
    setCurrentStep(prev => Math.min(prev + 1, 7));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setValidationErrors({});
  };

  const handleClose = () => {
    const hasData = formData.annualIncome > 0 ||
                    formData.monthlyRent > 0 ||
                    formData.needs.length > 0 ||
                    formData.wants.length > 0;

    if (hasData && !confirm('Are you sure you want to close? Your progress will be lost.')) {
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Step 1: Create new categories
      const newCategories = [
        ...formData.essentials.otherEssentials.filter(e => e.isNew && e.category.trim()),
        ...formData.needs.filter(n => n.isNew),
        ...formData.wants.filter(w => w.isNew),
      ];

      for (const cat of newCategories) {
        const categoryName = 'category' in cat ? cat.category : cat.categoryName;
        await api.createCategory({
          name: categoryName,
          type: 'Expenses',
          display_order: 0,
        });
      }

      // Step 2: Create budgets
      const budgetsToCreate = [];

      // Income budget
      if (formData.annualIncome > 0) {
        budgetsToCreate.push({
          type: 'Income',
          category: 'Employment',
          year: selectedYear,
          month: null,
          amount: formData.annualIncome,
        });
      }

      // Housing
      if (formData.monthlyRent > 0) {
        budgetsToCreate.push({
          type: 'Expenses',
          category: 'Housing',
          year: selectedYear,
          month: null,
          amount: formData.monthlyRent * 12,
        });
      }

      // Health Insurance
      if (formData.essentials.healthInsurance > 0) {
        budgetsToCreate.push({
          type: 'Expenses',
          category: 'Health Insurance',
          year: selectedYear,
          month: null,
          amount: formData.essentials.healthInsurance * 12,
        });
      }

      // Car Lease
      if (formData.essentials.carLease > 0) {
        budgetsToCreate.push({
          type: 'Expenses',
          category: 'Car',
          year: selectedYear,
          month: null,
          amount: formData.essentials.carLease * 12,
        });
      }

      // Debt Payments
      if (formData.essentials.debtPayments > 0) {
        budgetsToCreate.push({
          type: 'Expenses',
          category: 'Debt',
          year: selectedYear,
          month: null,
          amount: formData.essentials.debtPayments * 12,
        });
      }

      // Other essentials
      formData.essentials.otherEssentials.forEach(essential => {
        if (essential.amount > 0) {
          budgetsToCreate.push({
            type: 'Expenses',
            category: essential.category,
            year: selectedYear,
            month: null,
            amount: essential.amount * 12,
          });
        }
      });

      // Needs
      formData.needs.forEach(need => {
        if (need.monthlyAmount > 0) {
          budgetsToCreate.push({
            type: 'Expenses',
            category: need.categoryName,
            year: selectedYear,
            month: null,
            amount: need.monthlyAmount * 12,
          });
        }
      });

      // Wants
      formData.wants.forEach(want => {
        if (want.monthlyAmount > 0) {
          budgetsToCreate.push({
            type: 'Expenses',
            category: want.categoryName,
            year: selectedYear,
            month: null,
            amount: want.monthlyAmount * 12,
          });
        }
      });

      // Savings
      if (formData.annualSavingsGoal > 0) {
        budgetsToCreate.push({
          type: 'Savings',
          category: 'General Savings',
          year: selectedYear,
          month: null,
          amount: formData.annualSavingsGoal,
        });
      }

      // Create all budgets
      for (const budget of budgetsToCreate) {
        await api.createBudget(budget);
      }

      alert(`Successfully created ${budgetsToCreate.length} budget entries!`);
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('Failed to create budgets:', error);
      alert(error.response?.data?.detail || 'Failed to create budgets. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render progress indicator
  const renderProgress = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {stepTitles.map((title, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-200' :
                  isCompleted ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-600'}
              `}>
                {isCompleted ? <Check className="w-5 h-5" /> : stepNum}
              </div>
              <span className={`mt-2 text-xs font-medium hidden md:block ${
                isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
              }`}>
                {title}
              </span>
            </div>
            {idx < stepTitles.length - 1 && (
              <div className={`w-8 h-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // Step 1: Annual Income
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl text-center">
        <DollarSign className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your estimated annual income?</h2>
        <p className="text-gray-600 mb-6">Enter your total yearly income before taxes</p>

        <div className="max-w-md mx-auto">
          <input
            type="number"
            value={formData.annualIncome || ''}
            onChange={(e) => setFormData({ ...formData, annualIncome: Number(e.target.value) })}
            placeholder="e.g., 85000"
            className="w-full text-3xl text-center px-6 py-4 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          {formData.annualIncome > 0 && (
            <div className="mt-4 p-4 bg-white rounded-lg">
              <p className="text-sm text-gray-600">Monthly income</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatAmount(formData.annualIncome / 12)}
              </p>
            </div>
          )}
        </div>
      </div>

      {validationErrors.step && formData.annualIncome <= 0 && (
        <p className="text-red-600 text-sm text-center">{validationErrors.step}</p>
      )}
    </div>
  );

  // Step 2: Housing
  const renderStep2 = () => {
    const rentPercentage = monthlyIncome > 0 ? (formData.monthlyRent / monthlyIncome) * 100 : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl">
          <Home className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Housing Expenses</h2>
          <p className="text-gray-600 mb-6 text-center">Enter your monthly rent or mortgage payment</p>

          <div className="max-w-md mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Rent / Mortgage (CHF)
              </label>
              <input
                type="number"
                value={formData.monthlyRent || ''}
                onChange={(e) => setFormData({ ...formData, monthlyRent: Number(e.target.value) })}
                placeholder="e.g., 1500"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {formData.monthlyRent > 0 && (
              <div className={`p-4 rounded-lg ${
                rentPercentage > 40 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}>
                <p className="text-sm text-gray-600">Percentage of monthly income</p>
                <p className={`text-xl font-bold ${rentPercentage > 40 ? 'text-red-600' : 'text-green-600'}`}>
                  {rentPercentage.toFixed(1)}%
                </p>
                {rentPercentage > 40 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ Housing costs exceed 40% of income - consider if this is sustainable
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              Leave at 0 if you don't pay rent or own your home outright
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Step 3: Essentials
  const renderStep3 = () => {
    const addEssential = () => {
      setFormData({
        ...formData,
        essentials: {
          ...formData.essentials,
          otherEssentials: [
            ...formData.essentials.otherEssentials,
            { category: '', amount: 0, isNew: true }
          ]
        }
      });
    };

    const removeEssential = (index: number) => {
      setFormData({
        ...formData,
        essentials: {
          ...formData.essentials,
          otherEssentials: formData.essentials.otherEssentials.filter((_, i) => i !== index)
        }
      });
    };

    const updateEssential = (index: number, field: 'category' | 'amount', value: string | number) => {
      const updated = [...formData.essentials.otherEssentials];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({
        ...formData,
        essentials: { ...formData.essentials, otherEssentials: updated }
      });
    };

    const totalEssentials = fixedCosts - formData.monthlyRent;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-xl">
          <Heart className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Essential Expenses</h2>
          <p className="text-gray-600 mb-6 text-center">Fixed costs you must pay every month</p>

          <div className="max-w-2xl mx-auto space-y-4">
            {/* Fixed essentials */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Health Insurance (monthly)
              </label>
              <input
                type="number"
                value={formData.essentials.healthInsurance || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  essentials: { ...formData.essentials, healthInsurance: Number(e.target.value) }
                })}
                placeholder="e.g., 350"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Car Lease / Payment (monthly)
              </label>
              <input
                type="number"
                value={formData.essentials.carLease || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  essentials: { ...formData.essentials, carLease: Number(e.target.value) }
                })}
                placeholder="e.g., 400"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Debt Payments (monthly)
              </label>
              <input
                type="number"
                value={formData.essentials.debtPayments || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  essentials: { ...formData.essentials, debtPayments: Number(e.target.value) }
                })}
                placeholder="e.g., 200"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Dynamic essentials */}
            {formData.essentials.otherEssentials.map((essential, idx) => (
              <div key={idx} className="flex gap-2 p-3 bg-white rounded-lg border border-gray-200">
                <input
                  type="text"
                  placeholder="Category name (e.g., Internet)"
                  value={essential.category}
                  onChange={(e) => updateEssential(idx, 'category', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={essential.amount || ''}
                  onChange={(e) => updateEssential(idx, 'amount', Number(e.target.value))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={() => removeEssential(idx)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            <button
              onClick={addEssential}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Essential Expense
            </button>

            {/* Total */}
            <div className="mt-6 p-4 bg-white rounded-lg border-2 border-orange-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Fixed Essentials:</span>
                <span className="text-2xl font-bold text-orange-600">{formatAmount(totalEssentials)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 4: Needs
  const renderStep4 = () => {
    const expenseCategories = categories.filter(c => c.type === 'Expenses');
    const selectedNeedIds = new Set(formData.needs.filter(n => n.categoryId !== null).map(n => n.categoryId));

    const toggleNeedCategory = (categoryId: number, categoryName: string) => {
      if (selectedNeedIds.has(categoryId)) {
        // Remove from needs
        setFormData({
          ...formData,
          needs: formData.needs.filter(n => n.categoryId !== categoryId)
        });
      } else {
        // Add to needs
        setFormData({
          ...formData,
          needs: [...formData.needs, {
            categoryId,
            categoryName,
            isNew: false,
            monthlyAmount: 0
          }]
        });
      }
    };

    const updateNeedAmount = (categoryId: number | null, amount: number) => {
      setFormData({
        ...formData,
        needs: formData.needs.map(n =>
          n.categoryId === categoryId ? { ...n, monthlyAmount: amount } : n
        )
      });
    };

    const addNewNeed = () => {
      if (!newNeedName.trim()) {
        alert('Please enter a category name');
        return;
      }

      // Check for duplicates
      if (formData.needs.some(n => n.categoryName.toLowerCase() === newNeedName.toLowerCase().trim())) {
        alert('This category is already in your needs list');
        return;
      }

      setFormData({
        ...formData,
        needs: [...formData.needs, {
          categoryId: null,
          categoryName: newNeedName.trim(),
          isNew: true,
          monthlyAmount: 0
        }]
      });

      setNewNeedName('');
      setShowNewNeedInput(false);
    };

    const removeNeed = (index: number) => {
      setFormData({
        ...formData,
        needs: formData.needs.filter((_, i) => i !== index)
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-xl">
          <ShoppingCart className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Needs</h2>
          <p className="text-gray-600 mb-6 text-center">
            Essential variable expenses like groceries, transportation, and utilities
          </p>

          <div className="max-w-3xl mx-auto space-y-6">
            {/* Category selection grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {expenseCategories.map(cat => {
                const isSelected = selectedNeedIds.has(cat.id);
                const need = formData.needs.find(n => n.categoryId === cat.id);

                return (
                  <div
                    key={cat.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleNeedCategory(cat.id, cat.name)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </label>

                    {isSelected && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">Monthly amount (CHF)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={need?.monthlyAmount || ''}
                          onChange={(e) => updateNeedAmount(cat.id, Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New needs created inline */}
            {formData.needs.filter(n => n.isNew).map((need, idx) => (
              <div key={`new-${idx}`} className="flex gap-2 p-4 bg-white rounded-lg border-2 border-blue-200">
                <div className="flex-1">
                  <p className="font-medium text-blue-900 mb-2">{need.categoryName} (New)</p>
                  <input
                    type="number"
                    placeholder="Monthly amount"
                    value={need.monthlyAmount || ''}
                    onChange={(e) => {
                      const updated = [...formData.needs];
                      const newNeedIdx = formData.needs.indexOf(need);
                      updated[newNeedIdx] = { ...need, monthlyAmount: Number(e.target.value) };
                      setFormData({ ...formData, needs: updated });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => removeNeed(formData.needs.indexOf(need))}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Add new category */}
            {showNewNeedInput ? (
              <div className="flex gap-2 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                <input
                  type="text"
                  placeholder="Category name (e.g., Public Transport)"
                  value={newNeedName}
                  onChange={(e) => setNewNeedName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNewNeed()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={addNewNeed}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewNeedInput(false);
                    setNewNeedName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewNeedInput(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Need Category
              </button>
            )}

            {/* Total needs */}
            {formData.needs.length > 0 && (
              <div className="mt-6 p-4 bg-white rounded-lg border-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Needs:</span>
                  <span className="text-2xl font-bold text-blue-600">{formatAmount(needsTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {validationErrors.step && formData.needs.length === 0 && (
          <p className="text-red-600 text-sm text-center">{validationErrors.step}</p>
        )}
      </div>
    );
  };

  // Step 5: Wants
  const renderStep5 = () => {
    const expenseCategories = categories.filter(c => c.type === 'Expenses');
    const selectedWantIds = new Set(formData.wants.filter(w => w.categoryId !== null).map(w => w.categoryId));

    const toggleWantCategory = (categoryId: number, categoryName: string) => {
      if (selectedWantIds.has(categoryId)) {
        setFormData({
          ...formData,
          wants: formData.wants.filter(w => w.categoryId !== categoryId)
        });
      } else {
        setFormData({
          ...formData,
          wants: [...formData.wants, {
            categoryId,
            categoryName,
            isNew: false,
            monthlyAmount: 0
          }]
        });
      }
    };

    const updateWantAmount = (categoryId: number | null, amount: number) => {
      setFormData({
        ...formData,
        wants: formData.wants.map(w =>
          w.categoryId === categoryId ? { ...w, monthlyAmount: amount } : w
        )
      });
    };

    const addNewWant = () => {
      if (!newWantName.trim()) {
        alert('Please enter a category name');
        return;
      }

      if (formData.wants.some(w => w.categoryName.toLowerCase() === newWantName.toLowerCase().trim())) {
        alert('This category is already in your wants list');
        return;
      }

      setFormData({
        ...formData,
        wants: [...formData.wants, {
          categoryId: null,
          categoryName: newWantName.trim(),
          isNew: true,
          monthlyAmount: 0
        }]
      });

      setNewWantName('');
      setShowNewWantInput(false);
    };

    const removeWant = (index: number) => {
      setFormData({
        ...formData,
        wants: formData.wants.filter((_, i) => i !== index)
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-xl">
          <Smile className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Wants</h2>
          <p className="text-gray-600 mb-6 text-center">
            Discretionary expenses like dining out, entertainment, and hobbies (optional)
          </p>

          <div className="max-w-3xl mx-auto space-y-6">
            {/* Category selection grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {expenseCategories.map(cat => {
                const isSelected = selectedWantIds.has(cat.id);
                const want = formData.wants.find(w => w.categoryId === cat.id);

                return (
                  <div
                    key={cat.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleWantCategory(cat.id, cat.name)}
                        className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </label>

                    {isSelected && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">Monthly amount (CHF)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={want?.monthlyAmount || ''}
                          onChange={(e) => updateWantAmount(cat.id, Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New wants created inline */}
            {formData.wants.filter(w => w.isNew).map((want, idx) => (
              <div key={`new-${idx}`} className="flex gap-2 p-4 bg-white rounded-lg border-2 border-purple-200">
                <div className="flex-1">
                  <p className="font-medium text-purple-900 mb-2">{want.categoryName} (New)</p>
                  <input
                    type="number"
                    placeholder="Monthly amount"
                    value={want.monthlyAmount || ''}
                    onChange={(e) => {
                      const updated = [...formData.wants];
                      const newWantIdx = formData.wants.indexOf(want);
                      updated[newWantIdx] = { ...want, monthlyAmount: Number(e.target.value) };
                      setFormData({ ...formData, wants: updated });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={() => removeWant(formData.wants.indexOf(want))}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Add new category */}
            {showNewWantInput ? (
              <div className="flex gap-2 p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
                <input
                  type="text"
                  placeholder="Category name (e.g., Entertainment)"
                  value={newWantName}
                  onChange={(e) => setNewWantName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNewWant()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <button
                  onClick={addNewWant}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewWantInput(false);
                    setNewWantName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewWantInput(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Want Category
              </button>
            )}

            {/* Total wants */}
            {formData.wants.length > 0 && (
              <div className="mt-6 p-4 bg-white rounded-lg border-2 border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Wants:</span>
                  <span className="text-2xl font-bold text-purple-600">{formatAmount(wantsTotal)}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-500 text-center">
              💡 It's okay to skip wants for now - you can add them later!
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Step 6: Savings Goal
  const renderStep6 = () => {
    const savingsPercentage = formData.annualIncome > 0 ?
      (formData.annualSavingsGoal / formData.annualIncome) * 100 : 0;

    const setSavingsPreset = (percentage: number) => {
      setFormData({
        ...formData,
        annualSavingsGoal: Math.round(formData.annualIncome * percentage)
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-xl">
          <PiggyBank className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Savings Goal</h2>
          <p className="text-gray-600 mb-6 text-center">
            How much do you want to save annually?
          </p>

          <div className="max-w-md mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Annual Savings Goal (CHF)
              </label>
              <input
                type="number"
                value={formData.annualSavingsGoal || ''}
                onChange={(e) => setFormData({ ...formData, annualSavingsGoal: Number(e.target.value) })}
                placeholder="e.g., 12000"
                className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
              />
            </div>

            {formData.annualSavingsGoal > 0 && (
              <div className="bg-white p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly savings:</span>
                  <span className="font-bold text-green-600">{formatAmount(monthlySavings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Percentage of income:</span>
                  <span className="font-bold text-green-600">{savingsPercentage.toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Quick presets:</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSavingsPreset(0.10)}
                  className="px-4 py-2 border-2 border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                >
                  10%
                </button>
                <button
                  onClick={() => setSavingsPreset(0.20)}
                  className="px-4 py-2 border-2 border-green-400 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                >
                  20%
                </button>
                <button
                  onClick={() => setSavingsPreset(0.30)}
                  className="px-4 py-2 border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                >
                  30%
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Financial experts recommend saving 20-30% of income
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 7: Review & Adjust
  const renderStep7 = () => {
    const handleAllocationChange = (category: 'needs' | 'wants' | 'savings', newTotal: number) => {
      if (category === 'needs' && needsTotal > 0) {
        const ratio = newTotal / needsTotal;
        setFormData({
          ...formData,
          needs: formData.needs.map(n => ({
            ...n,
            monthlyAmount: Math.round(n.monthlyAmount * ratio * 100) / 100
          }))
        });
      } else if (category === 'wants' && wantsTotal > 0) {
        const ratio = newTotal / wantsTotal;
        setFormData({
          ...formData,
          wants: formData.wants.map(w => ({
            ...w,
            monthlyAmount: Math.round(w.monthlyAmount * ratio * 100) / 100
          }))
        });
      } else if (category === 'savings') {
        setFormData({
          ...formData,
          annualSavingsGoal: newTotal * 12
        });
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-xl">
          <TrendingUp className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Review & Adjust</h2>
          <p className="text-gray-600 mb-6 text-center">
            Fine-tune your budget allocations and see your balance
          </p>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* Monthly breakdown */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-indigo-200 p-6 space-y-4">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Monthly Budget Breakdown</h3>

              {/* Income */}
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-medium text-gray-700">Monthly Income</span>
                <span className="text-xl font-bold text-green-600">+ {formatAmount(monthlyIncome)}</span>
              </div>

              {/* Fixed costs */}
              <div className="space-y-2 pb-3 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fixed Costs (Housing + Essentials)</span>
                  <span className="font-medium text-gray-900">- {formatAmount(fixedCosts)}</span>
                </div>
                {formData.monthlyRent > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">• Housing</span>
                    <span className="text-gray-600">{formatAmount(formData.monthlyRent)}</span>
                  </div>
                )}
                {(formData.essentials.healthInsurance + formData.essentials.carLease + formData.essentials.debtPayments) > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">• Essentials</span>
                    <span className="text-gray-600">
                      {formatAmount(fixedCosts - formData.monthlyRent)}
                    </span>
                  </div>
                )}
              </div>

              {/* Adjustable allocations */}
              <div className="space-y-4 pt-2">
                {/* Needs */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-gray-700">Needs</label>
                    <input
                      type="number"
                      value={Math.round(needsTotal)}
                      onChange={(e) => handleAllocationChange('needs', Number(e.target.value))}
                      className="w-32 px-3 py-1 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={monthlyIncome - fixedCosts}
                    value={needsTotal}
                    onChange={(e) => handleAllocationChange('needs', Number(e.target.value))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Wants */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-gray-700">Wants</label>
                    <input
                      type="number"
                      value={Math.round(wantsTotal)}
                      onChange={(e) => handleAllocationChange('wants', Number(e.target.value))}
                      className="w-32 px-3 py-1 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={monthlyIncome - fixedCosts}
                    value={wantsTotal}
                    onChange={(e) => handleAllocationChange('wants', Number(e.target.value))}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                {/* Savings */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-gray-700">Savings</label>
                    <input
                      type="number"
                      value={Math.round(monthlySavings)}
                      onChange={(e) => handleAllocationChange('savings', Number(e.target.value))}
                      className="w-32 px-3 py-1 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={monthlyIncome - fixedCosts}
                    value={monthlySavings}
                    onChange={(e) => handleAllocationChange('savings', Number(e.target.value))}
                    className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                </div>
              </div>

              {/* Remaining balance */}
              <div className={`mt-6 p-4 rounded-lg ${
                remainingBalance >= 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Remaining Balance</span>
                  <span className={`text-3xl font-bold ${
                    remainingBalance >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatAmount(remainingBalance)}
                  </span>
                </div>
                {remainingBalance < 0 && (
                  <p className="text-sm text-red-700 mt-2">
                    ⚠️ You've allocated more than your income! Adjust your budget or you won't be able to proceed.
                  </p>
                )}
                {remainingBalance >= 0 && remainingBalance < 100 && (
                  <p className="text-sm text-green-700 mt-2">
                    ✓ Perfect! You've allocated almost all your income.
                  </p>
                )}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <p className="text-xs text-gray-600">Total Needs</p>
                <p className="text-2xl font-bold text-blue-600">{formatAmount(needsTotal)}</p>
                <p className="text-xs text-gray-500">{formData.needs.length} categories</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <p className="text-xs text-gray-600">Total Wants</p>
                <p className="text-2xl font-bold text-purple-600">{formatAmount(wantsTotal)}</p>
                <p className="text-xs text-gray-500">{formData.wants.length} categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Budget Wizard</h1>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-6 border-b border-gray-200">
          {renderProgress()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>

          <div className="text-sm text-gray-600">
            Step {currentStep} of 7
          </div>

          {currentStep < 7 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || remainingBalance < 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {isSubmitting ? 'Creating Budgets...' : 'Create Budget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
