import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import type { DashboardSummary, MonthlyTrend } from '../types';
import * as api from '../api';
import { MONTH_NAMES, CHART_COLORS } from '../constants';
import { formatAmount } from '../utils/formatters';
import { LoadingSpinner, Select, Button, Card } from '../components/ui';

const months = MONTH_NAMES;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubType, setSelectedSubType] = useState<string>('');
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);

  useEffect(() => {
    loadYears();
    initializeFilters();
  }, []);

  useEffect(() => {
    if (initialFiltersSet) {
      loadDashboardData();
    }
  }, [selectedYear, selectedMonth, selectedCategories, selectedSubType, initialFiltersSet]);

  const initializeFilters = async () => {
    try {
      // Fetch summary for current year to get latest transaction date
      const summaryData = await api.getDashboardSummary(new Date().getFullYear());

      if (summaryData.latest_transaction_date) {
        const latestDate = new Date(summaryData.latest_transaction_date);
        const year = latestDate.getFullYear();
        const month = latestDate.getMonth() + 1; // getMonth() returns 0-11

        setSelectedYear(year);
        setSelectedMonth(month);
      }

      setInitialFiltersSet(true);
    } catch (error) {
      console.error('Failed to initialize filters:', error);
      setInitialFiltersSet(true); // Set anyway to allow dashboard to load
    }
  };

  const loadYears = async () => {
    try {
      const yearsData = await api.getAvailableYears();
      setYears(yearsData);
      if (yearsData.length > 0 && !yearsData.includes(selectedYear)) {
        setSelectedYear(yearsData[0]);
      }
    } catch (error) {
      console.error('Failed to load years:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, trendData] = await Promise.all([
        api.getDashboardSummary(selectedYear, selectedMonth),
        api.getMonthlyTrend(selectedYear, selectedCategories.length > 0 ? selectedCategories : undefined),
      ]);
      setSummary(summaryData);
      setMonthlyTrend(trendData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatShortAmount = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`;
    }
    return amount.toFixed(0);
  };

  const getPeriodText = () => {
    if (selectedMonth) {
      return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    }
    return `${selectedYear} (Full Year)`;
  };

  if (loading) {
    return <LoadingSpinner centered size="lg" text="Loading dashboard..." />;
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available. Upload transactions to get started.</p>
      </div>
    );
  }

  // Filter summary data by sub_type if selected
  const filteredIncome = selectedSubType
    ? summary.income.filter((item) => (item as any).sub_type === selectedSubType)
    : summary.income;
  const filteredExpenses = selectedSubType
    ? summary.expenses.filter((item) => (item as any).sub_type === selectedSubType)
    : summary.expenses;
  const filteredSavings = selectedSubType
    ? summary.savings.filter((item) => (item as any).sub_type === selectedSubType)
    : summary.savings;

  // Calculate filtered totals
  const filteredTotals = {
    income: {
      actual: filteredIncome.reduce((sum, item) => sum + item.actual, 0),
      budget: filteredIncome.reduce((sum, item) => sum + item.budget, 0),
    },
    expenses: {
      actual: filteredExpenses.reduce((sum, item) => sum + item.actual, 0),
      budget: filteredExpenses.reduce((sum, item) => sum + item.budget, 0),
    },
    savings: {
      actual: filteredSavings.reduce((sum, item) => sum + item.actual, 0),
      budget: filteredSavings.reduce((sum, item) => sum + item.budget, 0),
    },
    net: {
      actual: 0,
      budget: 0,
    },
  };
  filteredTotals.net.actual = filteredTotals.income.actual - filteredTotals.expenses.actual - filteredTotals.savings.actual;
  filteredTotals.net.budget = filteredTotals.income.budget - filteredTotals.expenses.budget - filteredTotals.savings.budget;

  const displaySummary = selectedSubType ? {
    ...summary,
    income: filteredIncome,
    expenses: filteredExpenses,
    savings: filteredSavings,
    totals: filteredTotals,
  } : summary;

  // Check if any items have sub_type
  const hasSubTypes = [...summary.income, ...summary.expenses, ...summary.savings].some(
    (item) => (item as any).sub_type != null
  );

  // Prepare data for charts
  const topExpenses = displaySummary.expenses
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 10)
    .map((item) => ({
      category: item.category,
      actual: item.actual,
      budget: item.budget,
      remaining: item.remaining,
    }));

  const pieData = [
    { name: 'Income', value: displaySummary.totals.income.actual, color: CHART_COLORS.income },
    { name: 'Expenses', value: displaySummary.totals.expenses.actual, color: CHART_COLORS.expenses },
    { name: 'Savings', value: displaySummary.totals.savings.actual, color: CHART_COLORS.savings },
  ];

  const trendChartData = monthlyTrend.map((item) => ({
    month: MONTH_NAMES[item.month - 1].substring(0, 3),
    Income: item.Income,
    Expenses: item.Expenses,
    Savings: item.Savings,
    IncomeBudget: item.IncomeBudget,
    ExpensesBudget: item.ExpensesBudget,
    SavingsBudget: item.SavingsBudget,
  }));

  const netActual = displaySummary.totals.net.actual;
  const isPositiveNet = netActual >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview for {getPeriodText()}</p>
          {summary.latest_transaction_date && (
            <p className="text-gray-400 text-sm">
              Latest data until {new Date(summary.latest_transaction_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Select
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={years.map((y) => ({ value: y, label: String(y) }))}
            className="text-sm"
          />

          <Select
            label="Period"
            value={selectedMonth || ''}
            onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : undefined)}
            options={[
              { value: '', label: 'Full Year' },
              ...months.map((month, i) => ({ value: i + 1, label: month })),
            ]}
            className="text-sm"
          />

          {hasSubTypes && (
            <Select
              label="Sub-Type"
              value={selectedSubType}
              onChange={(e) => setSelectedSubType(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: 'Essentials', label: 'Essentials' },
                { value: 'Needs', label: 'Needs' },
                { value: 'Wants', label: 'Wants' },
              ]}
              className="text-sm"
            />
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Category Filter {selectedCategories.length > 0 && `(${selectedCategories.length} selected)`}
            </label>
            <select
              multiple
              value={selectedCategories}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedCategories(selected);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[42px]"
              size={1}
              onFocus={(e) => e.target.size = Math.min(8, (summary ? [...summary.income, ...summary.expenses, ...summary.savings].map(item => item.category).filter((v, i, a) => a.indexOf(v) === i).length + 1 : 1))}
              onBlur={(e) => e.target.size = 1}
            >
              {summary && [...summary.income, ...summary.expenses, ...summary.savings]
                .map(item => item.category)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort()
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
            {selectedCategories.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="text-xs mt-1"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        {/* Income Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">INCOME</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(displaySummary.totals.income.actual)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: {formatAmount(displaySummary.totals.income.budget)}
            </p>
            <div className="mt-3">
              {(() => {
                const incomePercent = displaySummary.totals.income.budget > 0
                  ? (displaySummary.totals.income.actual / displaySummary.totals.income.budget) * 100
                  : 0;
                const colorClass = incomePercent < 100
                  ? 'bg-red-100 text-red-700 border-red-300'
                  : incomePercent > 100
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300';
                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
                    {incomePercent.toFixed(1)}% of Budget
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">EXPENSES</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(displaySummary.totals.expenses.actual)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: {formatAmount(displaySummary.totals.expenses.budget)}
            </p>
            <div className="mt-3">
              {(() => {
                const expensePercent = displaySummary.totals.expenses.budget > 0
                  ? (displaySummary.totals.expenses.actual / displaySummary.totals.expenses.budget) * 100
                  : 0;
                const colorClass = expensePercent < 100
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : expensePercent > 100
                    ? 'bg-red-100 text-red-700 border-red-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300';
                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
                    {expensePercent.toFixed(1)}% of Budget
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Fixed Cost Ratio Card (replaces Savings) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">FIXED COST RATIO</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{summary.fixed_cost_ratio.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">
              Housing + Health + Tax
            </p>
            <div className="mt-3">
              {(() => {
                const ratio = summary.fixed_cost_ratio;
                const colorClass = ratio < 50
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : ratio < 60
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    : 'bg-red-100 text-red-700 border-red-300';
                const label = ratio < 50 ? 'Excellent' : ratio < 60 ? 'Good' : 'High';
                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
                    {label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Net Balance Card - YoY Comparison */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${isPositiveNet ? 'bg-green-100' : 'bg-red-100'}`}>
              <Calendar className={`w-6 h-6 ${isPositiveNet ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <span className="text-xs font-medium text-gray-500">NET BALANCE</span>
          </div>
          <div>
            <p className={`text-2xl font-bold ${isPositiveNet ? 'text-green-600' : 'text-red-600'}`}>
              {formatAmount(netActual)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              vs {summary.previous_period.month ? MONTH_NAMES[summary.previous_period.month - 1] : 'Full Year'} {summary.previous_period.year}
            </p>
            <div className="mt-3">
              {(() => {
                const prevNet = summary.previous_period.net;
                const change = netActual - prevNet;
                const changePercent = prevNet !== 0 ? (change / Math.abs(prevNet)) * 100 : 0;
                const isPositive = change >= 0;
                const colorClass = isPositive
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-red-100 text-red-700 border-red-300';
                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
                    {isPositive ? '+' : ''}{formatAmount(change)} ({isPositive ? '+' : ''}{changePercent.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart - Full Width */}
      <Card className="border border-gray-200" shadow="sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Monthly Trend - {selectedYear}
          {selectedCategories.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {' '}({selectedCategories.length === 1 ? `Category: ${selectedCategories[0]}` : `${selectedCategories.length} categories selected`})
            </span>
          )}
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatShortAmount} />
            <Tooltip
              formatter={(value: number | undefined) => {
                if (value === undefined) return 'N/A';
                return formatAmount(value);
              }}
            />
            <Legend />
            <Bar dataKey="Income" fill={CHART_COLORS.income} name="Income" />
            <Bar dataKey="IncomeBudget" fill="#9ca3af" legendType="none" />
            <Bar dataKey="Expenses" fill={CHART_COLORS.expenses} name="Expenses" />
            <Bar dataKey="ExpensesBudget" fill="#9ca3af" legendType="none" />
            <Bar dataKey="Savings" fill={CHART_COLORS.savings} name="Savings" />
            <Bar dataKey="SavingsBudget" fill="#9ca3af" legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Colored bars show actual values, grey bars show budgeted values
        </p>
      </Card>

      {/* Bottom Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart - Distribution */}
        <Card className="border border-gray-200" shadow="sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatAmount(value) : 'N/A'} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Expenses Chart */}
        <Card className="border border-gray-200" shadow="sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Expense Categories</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topExpenses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatShortAmount} />
              <YAxis dataKey="category" type="category" width={150} />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatAmount(value) : 'N/A'} />
              <Legend />
              <Bar dataKey="actual" fill={CHART_COLORS.expenses} name="Actual" />
              <Bar dataKey="budget" fill={CHART_COLORS.remaining} name="Budget" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Breakdown Tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Income Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Income Breakdown</h3>
          </div>
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600">Category</th>
                  <th className="text-right py-2 text-gray-600">Actual</th>
                  <th className="text-right py-2 text-gray-600">%</th>
                </tr>
              </thead>
              <tbody>
                {summary.income.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{item.category}</td>
                    <td className="text-right text-gray-900 font-medium">{formatAmount(item.actual)}</td>
                    <td className="text-right text-green-600">{item.percent_complete.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="text-right">{formatAmount(summary.totals.income.actual)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Expenses Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Expenses Breakdown</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600">Category</th>
                  <th className="text-right py-2 text-gray-600">Actual</th>
                  <th className="text-right py-2 text-gray-600">%</th>
                </tr>
              </thead>
              <tbody>
                {summary.expenses.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{item.category}</td>
                    <td className="text-right text-gray-900 font-medium">{formatAmount(item.actual)}</td>
                    <td className={`text-right ${item.percent_complete > 100 ? 'text-red-600' : 'text-gray-600'}`}>
                      {item.percent_complete.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white">
                <tr className="font-semibold border-t-2 border-gray-300">
                  <td className="py-2">Total</td>
                  <td className="text-right">{formatAmount(summary.totals.expenses.actual)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Savings Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Savings Breakdown</h3>
          </div>
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600">Category</th>
                  <th className="text-right py-2 text-gray-600">Actual</th>
                  <th className="text-right py-2 text-gray-600">%</th>
                </tr>
              </thead>
              <tbody>
                {summary.savings.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{item.category}</td>
                    <td className="text-right text-gray-900 font-medium">{formatAmount(item.actual)}</td>
                    <td className="text-right text-blue-600">{item.percent_complete.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="text-right">{formatAmount(summary.totals.savings.actual)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
