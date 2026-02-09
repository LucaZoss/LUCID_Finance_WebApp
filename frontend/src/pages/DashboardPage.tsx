import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  Line,
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

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const COLORS = {
    income: '#22c55e',
    expenses: '#ef4444',
    savings: '#3b82f6',
    remaining: '#f59e0b',
  };

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear, selectedMonth, selectedCategories]);

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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatShortAmount = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`;
    }
    return amount.toFixed(0);
  };

  const getPeriodText = () => {
    if (selectedMonth) {
      return `${months[selectedMonth - 1]} ${selectedYear}`;
    }
    return `${selectedYear} (Full Year)`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available. Upload transactions to get started.</p>
      </div>
    );
  }

  // Prepare data for charts
  const topExpenses = summary.expenses
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 10)
    .map((item) => ({
      category: item.category,
      actual: item.actual,
      budget: item.budget,
      remaining: item.remaining,
    }));

  const pieData = [
    { name: 'Income', value: summary.totals.income.actual, color: COLORS.income },
    { name: 'Expenses', value: summary.totals.expenses.actual, color: COLORS.expenses },
    { name: 'Savings', value: summary.totals.savings.actual, color: COLORS.savings },
  ];

  const trendChartData = monthlyTrend.map((item) => ({
    month: months[item.month - 1].substring(0, 3),
    Income: item.Income,
    Expenses: item.Expenses,
    Savings: item.Savings,
    Surplus: item.Income - item.Expenses,
    SurplusPercent: item.Income > 0 ? ((item.Income - item.Expenses) / item.Income) * 100 : 0,
  }));

  const netActual = summary.totals.net.actual;
  const netBudget = summary.totals.net.budget;
  const isPositiveNet = netActual >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview for {getPeriodText()}</p>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : undefined)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Full Year</option>
              {months.map((month, i) => (
                <option key={i} value={i + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

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
              <button
                onClick={() => setSelectedCategories([])}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">INCOME</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.totals.income.actual)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: {formatAmount(summary.totals.income.budget)}
            </p>
            <div className="mt-2 flex items-center text-sm">
              {summary.totals.income.actual >= summary.totals.income.budget ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {((summary.totals.income.actual / summary.totals.income.budget) * 100 - 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  {((summary.totals.income.actual / summary.totals.income.budget) * 100 - 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">EXPENSES</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.totals.expenses.actual)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: {formatAmount(summary.totals.expenses.budget)}
            </p>
            <div className="mt-2 flex items-center text-sm">
              {summary.totals.expenses.actual <= summary.totals.expenses.budget ? (
                <span className="text-green-600">
                  Under budget by {formatAmount(summary.totals.expenses.budget - summary.totals.expenses.actual)}
                </span>
              ) : (
                <span className="text-red-600">
                  Over budget by {formatAmount(summary.totals.expenses.actual - summary.totals.expenses.budget)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">SAVINGS</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.totals.savings.actual)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: {formatAmount(summary.totals.savings.budget)}
            </p>
            <div className="mt-2 flex items-center text-sm">
              {summary.totals.savings.actual >= summary.totals.savings.budget ? (
                <span className="text-green-600">
                  Ahead by {formatAmount(summary.totals.savings.actual - summary.totals.savings.budget)}
                </span>
              ) : (
                <span className="text-gray-600">
                  {formatAmount(summary.totals.savings.budget - summary.totals.savings.actual)} remaining
                </span>
              )}
            </div>
          </div>
        </div>

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
              Budget: {formatAmount(netBudget)}
            </p>
            <div className="mt-2 flex items-center text-sm">
              {isPositiveNet ? (
                <span className="text-green-600">Surplus</span>
              ) : (
                <span className="text-red-600">Deficit</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart - Full Width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
            <YAxis yAxisId="left" tickFormatter={formatShortAmount} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value.toFixed(0)}%`} />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                if (value === undefined) return 'N/A';
                if (name === 'Surplus Rate') {
                  return `${value.toFixed(1)}%`;
                }
                return formatAmount(value);
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="Income" fill={COLORS.income} name="Income" />
            <Bar yAxisId="left" dataKey="Expenses" fill={COLORS.expenses} name="Expenses" />
            <Bar yAxisId="left" dataKey="Savings" fill={COLORS.savings} name="Savings" />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="SurplusPercent"
              stroke={COLORS.remaining}
              strokeWidth={3}
              name="Surplus Rate"
              dot={{ fill: COLORS.remaining, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Surplus Rate shows the percentage of income remaining after expenses (before savings allocation)
        </p>
      </div>

      {/* Bottom Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart - Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        </div>

        {/* Top Expenses Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Expense Categories</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topExpenses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatShortAmount} />
              <YAxis dataKey="category" type="category" width={150} />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatAmount(value) : 'N/A'} />
              <Legend />
              <Bar dataKey="actual" fill={COLORS.expenses} name="Actual" />
              <Bar dataKey="budget" fill={COLORS.remaining} name="Budget" />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
