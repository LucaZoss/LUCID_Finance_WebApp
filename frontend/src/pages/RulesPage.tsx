import { useState, useEffect } from 'react';
import { Filter, Plus, Trash2, Save, X, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import type { CategorizationRule, RuleCreate, RuleUpdate } from '../api';
import type { CategoryInfo } from '../types';
import * as api from '../api';

export default function RulesPage() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [applying, setApplying] = useState(false);

  // Form state
  const [formData, setFormData] = useState<RuleCreate>({
    pattern: '',
    case_sensitive: false,
    amount_operator: null,
    amount_value: null,
    type: 'Expenses',
    category: '',
    priority: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rulesData, categoriesData, typesData] = await Promise.all([
        api.getRules(),
        api.getCategories(),
        api.getTypes(),
      ]);
      setRules(rulesData);
      setCategories(categoriesData);
      setTypes(typesData);
    } catch (error: unknown) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!formData.pattern || !formData.category) {
      alert('Pattern and category are required');
      return;
    }

    try {
      const newRule = await api.createRule(formData);
      setRules([newRule, ...rules]);
      setShowAddForm(false);
      resetForm();
    } catch (error: unknown) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule');
    }
  };

  const handleUpdateRule = async (id: number, update: RuleUpdate) => {
    try {
      const updatedRule = await api.updateRule(id, update);
      setRules(rules.map((r) => (r.id === id ? updatedRule : r)));
    } catch (error: unknown) {
      console.error('Failed to update rule:', error);
      alert('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await api.deleteRule(id);
      setRules(rules.filter((r) => r.id !== id));
    } catch (error: unknown) {
      console.error('Failed to delete rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleToggleActive = async (rule: CategorizationRule) => {
    await handleUpdateRule(rule.id, { is_active: !rule.is_active });
  };

  const handleApplyRules = async () => {
    if (!confirm('Apply current rules to all existing transactions? This will re-categorize transactions that match your rules.')) {
      return;
    }

    setApplying(true);
    try {
      const result = await api.applyRulesToTransactions();
      alert(
        `✅ ${result.message}\n\n` +
        `• Updated: ${result.updated_count} transactions\n` +
        `• Total: ${result.total_transactions} transactions\n` +
        `• Active rules: ${result.active_rules}`
      );
    } catch (error: unknown) {
      console.error('Failed to apply rules:', error);
      alert('Failed to apply rules to transactions');
    } finally {
      setApplying(false);
    }
  };

  const resetForm = () => {
    setFormData({
      pattern: '',
      case_sensitive: false,
      amount_operator: null,
      amount_value: null,
      type: 'Expenses',
      category: '',
      priority: 0,
    });
  };

  const getCategoriesForType = (type: string): string[] => {
    const categoryInfo = categories.find((c) => c.type === type);
    return categoryInfo?.categories || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-7 h-7 text-blue-600" />
            Categorization Rules
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Create custom rules to automatically categorize transactions based on description patterns
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApplyRules}
            disabled={applying || rules.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Apply current rules to all existing transactions"
          >
            <RefreshCw className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
            {applying ? 'Applying...' : 'Apply to Existing'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern (text to match)
              </label>
              <input
                type="text"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., netflix, amazon, uber"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Higher = checked first</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value, category: '' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select category...</option>
                {getCategoriesForType(formData.type).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Condition (optional)
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.amount_operator || ''}
                  onChange={(e) => setFormData({ ...formData, amount_operator: e.target.value || null })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="eq">=</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_value || ''}
                  onChange={(e) => setFormData({ ...formData, amount_value: e.target.value ? parseFloat(e.target.value) : null })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Amount"
                  disabled={!formData.amount_operator}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Match only if amount meets condition</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="case-sensitive"
                checked={formData.case_sensitive}
                onChange={(e) => setFormData({ ...formData, case_sensitive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="case-sensitive" className="ml-2 text-sm text-gray-700">
                Case sensitive
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateRule}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Rule
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pattern
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount Condition
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type / Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Options
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No rules yet. Create your first rule to automatically categorize transactions.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className={rule.is_active ? '' : 'opacity-50 bg-gray-50'}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          rule.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {rule.pattern}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {rule.amount_operator && rule.amount_value !== null ? (
                        <div className="text-sm">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {rule.amount_operator === 'eq' && '='}
                            {rule.amount_operator === 'gte' && '≥'}
                            {rule.amount_operator === 'lte' && '≤'}
                            {rule.amount_operator === 'gt' && '>'}
                            {rule.amount_operator === 'lt' && '<'}
                            {' '}
                            {rule.amount_value.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{rule.type}</div>
                        <div className="text-gray-500">{rule.category}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-gray-900">{rule.priority}</span>
                        {rule.priority > 0 && <ArrowUp className="w-3 h-3 text-blue-600" />}
                        {rule.priority < 0 && <ArrowDown className="w-3 h-3 text-gray-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.case_sensitive && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                          Case sensitive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">How Rules Work</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Rules automatically apply to new transactions when uploading CSV files</li>
          <li>• Click "Apply to Existing" to re-categorize all existing transactions with current rules</li>
          <li>• Rules are checked in priority order (highest first)</li>
          <li>• A transaction must match both the pattern AND the amount condition (if specified)</li>
          <li>• Amount conditions are optional - useful for distinguishing similar transactions by value</li>
          <li>• Use higher priority values for more specific rules that should match first</li>
        </ul>
      </div>
    </div>
  );
}
