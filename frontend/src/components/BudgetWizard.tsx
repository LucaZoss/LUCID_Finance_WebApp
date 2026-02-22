import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, DollarSign, Home, ShoppingCart, Smile, TrendingUp, Plus, Trash2 } from 'lucide-react';
import * as api from '../api';
import { formatAmount } from '../utils/formatters';
import { Button, Modal, ModalFooter } from './ui';

interface WizardFormData {
  // Step 1
  annualIncome: number;

  // Step 2 - Essential Fixed Costs
  monthlyRent: number;
  healthInsurance: number;

  // Step 3 - Needs
  needs: Array<{
    categoryId: number | null;
    categoryName: string;
    isNew: boolean;
    monthlyAmount: number;
  }>;

  // Step 4 - Wants
  wants: Array<{
    categoryId: number | null;
    categoryName: string;
    isNew: boolean;
    monthlyAmount: number;
  }>;
}

interface BudgetWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedYear: number;
}

const initialFormData: WizardFormData = {
  annualIncome: 0,
  monthlyRent: 0,
  healthInsurance: 0,
  needs: [],
  wants: [],
};

export default function BudgetWizard({ onClose, onSuccess, selectedYear }: BudgetWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<WizardFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [existingBudgets, setExistingBudgets] = useState<Map<string, number>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for new category inputs
  const [showNewNeedInput, setShowNewNeedInput] = useState(false);
  const [newNeedName, setNewNeedName] = useState('');
  const [showNewWantInput, setShowNewWantInput] = useState(false);
  const [newWantName, setNewWantName] = useState('');

  const stepTitles = ['Income', 'Essentials', 'Needs', 'Wants', 'Review'];

  // Load categories and existing budgets on mount
  useEffect(() => {
    loadCategories();
    loadExistingBudgets();
  }, [selectedYear]);

  const loadCategories = async () => {
    try {
      const allCats = await api.getAllCategories();
      setCategories(allCats.filter(c => c.is_active));
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadExistingBudgets = async () => {
    try {
      const budgets = await api.getBudgets(selectedYear);
      const budgetMap = new Map<string, number>();

      budgets.forEach(budget => {
        // Store monthly amount (convert from yearly if needed)
        const monthlyAmount = budget.month === null ? budget.amount / 12 : budget.amount;
        budgetMap.set(budget.category.toLowerCase(), monthlyAmount);
      });

      setExistingBudgets(budgetMap);
    } catch (error) {
      console.error('Failed to load existing budgets:', error);
    }
  };

  // Calculated values for Step 7
  const monthlyIncome = useMemo(() => formData.annualIncome / 12, [formData.annualIncome]);

  const fixedCosts = useMemo(() => {
    return formData.monthlyRent + formData.healthInsurance;
  }, [formData.monthlyRent, formData.healthInsurance]);

  const needsTotal = useMemo(() =>
    formData.needs.reduce((sum, n) => sum + n.monthlyAmount, 0),
    [formData.needs]
  );

  const wantsTotal = useMemo(() =>
    formData.wants.reduce((sum, w) => sum + w.monthlyAmount, 0),
    [formData.wants]
  );

  // Automatic savings calculation (what's left after all expenses)
  const monthlySavings = useMemo(() =>
    monthlyIncome - fixedCosts - needsTotal - wantsTotal,
    [monthlyIncome, fixedCosts, needsTotal, wantsTotal]
  );

  // Savings percentage (color-coded in Review step)
  const savingsPercentage = useMemo(() =>
    monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0,
    [monthlySavings, monthlyIncome]
  );

  // Fixed Cost Ratio: (Housing + Health Insurance + Needs) / Income
  const fixedCostRatio = useMemo(() =>
    monthlyIncome > 0 ? ((fixedCosts + needsTotal) / monthlyIncome) * 100 : 0,
    [fixedCosts, needsTotal, monthlyIncome]
  );

  // Validation functions
  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.annualIncome > 0;
      case 2:
        return formData.monthlyRent >= 0 && formData.healthInsurance >= 0;
      case 3:
        return formData.needs.length > 0 &&
               formData.needs.every(n => n.monthlyAmount > 0);
      case 4:
        return formData.wants.every(w => w.monthlyAmount >= 0);
      case 5:
        return true; // Review step
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
    setCurrentStep(prev => Math.min(prev + 1, 5));
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
        ...formData.needs.filter(n => n.isNew),
        ...formData.wants.filter(w => w.isNew),
      ];

      for (const cat of newCategories) {
        await api.createCategory({
          name: cat.categoryName,
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
      if (formData.healthInsurance > 0) {
        budgetsToCreate.push({
          type: 'Expenses',
          category: 'Health Insurance',
          year: selectedYear,
          month: null,
          amount: formData.healthInsurance * 12,
        });
      }


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

      // Savings (automatic - calculated from remaining balance)
      if (monthlySavings > 0) {
        budgetsToCreate.push({
          type: 'Savings',
          category: 'General Savings',
          year: selectedYear,
          month: null,
          amount: monthlySavings * 12,
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
  const renderStep1 = () => {
    const suggestedIncome = existingBudgets.get('employment') ? existingBudgets.get('employment')! * 12 : 0;

    return (
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
              placeholder={suggestedIncome > 0 ? `Suggested: ${suggestedIncome.toFixed(0)}` : "e.g., 85000"}
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
  };

  // Step 2: Essential Fixed Costs (Housing + Health Insurance)
  const renderStep2 = () => {
    const totalEssentialCosts = formData.monthlyRent + formData.healthInsurance;
    const essentialPercentage = monthlyIncome > 0 ? (totalEssentialCosts / monthlyIncome) * 100 : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl">
          <Home className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Essential Fixed Costs</h2>
          <p className="text-gray-600 mb-6 text-center">Your most critical monthly expenses</p>

          <div className="max-w-md mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Housing (Rent / Mortgage) - CHF
              </label>
              <input
                type="number"
                value={formData.monthlyRent || ''}
                onChange={(e) => setFormData({ ...formData, monthlyRent: Number(e.target.value) })}
                placeholder={existingBudgets.has('housing') ? `Suggested: ${existingBudgets.get('housing')?.toFixed(0)}` : 'e.g., 1500'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave at 0 if you own your home outright
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Health Insurance - CHF
              </label>
              <input
                type="number"
                value={formData.healthInsurance || ''}
                onChange={(e) => setFormData({ ...formData, healthInsurance: Number(e.target.value) })}
                placeholder={existingBudgets.has('health insurance') ? `Suggested: ${existingBudgets.get('health insurance')?.toFixed(0)}` : 'e.g., 350'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {totalEssentialCosts > 0 && (
              <div className={`p-4 rounded-lg ${
                essentialPercentage > 50 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Essential Costs:</span>
                    <span className="font-bold text-gray-900">{formatAmount(totalEssentialCosts)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Percentage of income:</span>
                    <span className={`font-bold ${essentialPercentage > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {essentialPercentage.toFixed(1)}%
                    </span>
                  </div>
                  {essentialPercentage > 50 && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ Essential costs exceed 50% of income - this leaves little room for other expenses
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  // Step 3: Needs (renamed from Step 4)
  const renderStep3 = () => {
    // Filter out Housing and Health Insurance (already covered in Step 2)
    const expenseCategories = categories.filter(c =>
      c.type === 'Expenses' &&
      c.name.toLowerCase() !== 'housing' &&
      c.name.toLowerCase() !== 'health insurance'
    );
    const selectedNeedIds = new Set(formData.needs.filter(n => n.categoryId !== null).map(n => n.categoryId));

    const toggleNeedCategory = (categoryId: number, categoryName: string) => {
      if (selectedNeedIds.has(categoryId)) {
        // Remove from needs
        setFormData({
          ...formData,
          needs: formData.needs.filter(n => n.categoryId !== categoryId)
        });
      } else {
        // Add to needs with suggested amount if available
        const suggestedAmount = existingBudgets.get(categoryName.toLowerCase()) || 0;
        setFormData({
          ...formData,
          needs: [...formData.needs, {
            categoryId,
            categoryName,
            isNew: false,
            monthlyAmount: suggestedAmount
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
                        <label className="block text-xs text-gray-600 mb-1">
                          Monthly amount (CHF)
                          {existingBudgets.has(cat.name.toLowerCase()) && (
                            <span className="ml-2 text-green-600 font-medium">
                              (Suggested: {existingBudgets.get(cat.name.toLowerCase())?.toFixed(0)})
                            </span>
                          )}
                        </label>
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

  // Step 4: Wants (renamed from Step 5)
  const renderStep4 = () => {
    // Get IDs of categories already selected as Needs
    const selectedNeedCategoryIds = new Set(formData.needs.filter(n => n.categoryId !== null).map(n => n.categoryId));

    // Filter out Housing, Health Insurance, and categories already selected as Needs
    const expenseCategories = categories.filter(c =>
      c.type === 'Expenses' &&
      c.name.toLowerCase() !== 'housing' &&
      c.name.toLowerCase() !== 'health insurance' &&
      !selectedNeedCategoryIds.has(c.id)
    );
    const selectedWantIds = new Set(formData.wants.filter(w => w.categoryId !== null).map(w => w.categoryId));

    const toggleWantCategory = (categoryId: number, categoryName: string) => {
      if (selectedWantIds.has(categoryId)) {
        setFormData({
          ...formData,
          wants: formData.wants.filter(w => w.categoryId !== categoryId)
        });
      } else {
        // Add to wants with suggested amount if available
        const suggestedAmount = existingBudgets.get(categoryName.toLowerCase()) || 0;
        setFormData({
          ...formData,
          wants: [...formData.wants, {
            categoryId,
            categoryName,
            isNew: false,
            monthlyAmount: suggestedAmount
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
                        <label className="block text-xs text-gray-600 mb-1">
                          Monthly amount (CHF)
                          {existingBudgets.has(cat.name.toLowerCase()) && (
                            <span className="ml-2 text-green-600 font-medium">
                              (Suggested: {existingBudgets.get(cat.name.toLowerCase())?.toFixed(0)})
                            </span>
                          )}
                        </label>
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

  // Step 5: Review & Adjust (automatic savings calculation)
  const renderStep5 = () => {
    const handleAllocationChange = (category: 'needs' | 'wants', newTotal: number) => {
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
      }
    };

    // Get color for savings percentage
    const getSavingsColor = () => {
      if (savingsPercentage >= 30) return 'bg-green-50 border-green-300 text-green-700';
      if (savingsPercentage >= 0) return 'bg-yellow-50 border-yellow-300 text-yellow-700';
      return 'bg-red-50 border-red-300 text-red-700';
    };

    const getSavingsTextColor = () => {
      if (savingsPercentage >= 30) return 'text-green-700';
      if (savingsPercentage >= 0) return 'text-yellow-700';
      return 'text-red-700';
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
                  <span className="text-gray-600">Fixed Costs (Housing + Health Insurance)</span>
                  <span className="font-medium text-gray-900">- {formatAmount(fixedCosts)}</span>
                </div>
                {formData.monthlyRent > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">• Housing</span>
                    <span className="text-gray-600">{formatAmount(formData.monthlyRent)}</span>
                  </div>
                )}
                {formData.healthInsurance > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">• Health Insurance</span>
                    <span className="text-gray-600">{formatAmount(formData.healthInsurance)}</span>
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
              </div>

              {/* Automatic Savings Display */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${getSavingsColor()}`}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Annual Savings</span>
                    <span className={`text-3xl font-bold ${getSavingsTextColor()}`}>
                      {formatAmount(monthlySavings * 12)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">Savings Rate (% of yearly income):</span>
                    <span className={`text-xl font-bold ${getSavingsTextColor()}`}>
                      {savingsPercentage.toFixed(1)}%
                    </span>
                  </div>
                  {savingsPercentage >= 30 && (
                    <p className="text-sm text-green-700">
                      ✓ Excellent! You're saving 30%+ of your income.
                    </p>
                  )}
                  {savingsPercentage >= 0 && savingsPercentage < 30 && (
                    <p className="text-sm text-yellow-700">
                      Good start! Consider reducing wants to increase savings to 30%.
                    </p>
                  )}
                  {savingsPercentage < 0 && (
                    <p className="text-sm text-red-700">
                      ⚠️ Negative savings! You're spending more than you earn.
                    </p>
                  )}
                </div>
              </div>

              {/* Fixed Cost Ratio */}
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Fixed Cost Ratio</span>
                  <span className="text-xl font-bold text-blue-700">
                    {fixedCostRatio.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  (Housing + Health Insurance + Needs) / Income
                </p>
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
      default: return null;
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title="Budget Wizard"
      maxWidth="4xl"
      showCloseButton={true}
    >
      <div className="flex flex-col max-h-[calc(90vh-8rem)]">{/* Adjusted for modal header height */}

        {/* Progress Indicator */}
        <div className="px-6 py-6 border-b border-gray-200">
          {renderProgress()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer Navigation */}
        <ModalFooter className="bg-gray-50 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="text-sm text-gray-600">
            Step {currentStep} of 5
          </div>

          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              className="flex items-center"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="success"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              {isSubmitting ? 'Creating Budgets...' : 'Create Budget'}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
