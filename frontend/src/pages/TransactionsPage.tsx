import { useState, useEffect, useRef } from 'react';
import { Upload, Search, Edit2, Check, X, Trash2, RefreshCw } from 'lucide-react';
import type { Transaction, CategoryInfo } from '../types';
import * as api from '../api';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ type: '', category: '' });

  // Filters
  const [filterYear, setFilterYear] = useState<number | undefined>();
  const [filterMonth, setFilterMonth] = useState<number | undefined>();
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Upload refs
  const ubsFileRef = useRef<HTMLInputElement>(null);
  const ccFileRef = useRef<HTMLInputElement>(null);
  const [ubsFile, setUbsFile] = useState<File | null>(null);
  const [ccFile, setCcFile] = useState<File | null>(null);

  // Available years
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [filterYear, filterMonth, filterType, filterCategory, filterAmountMin, filterAmountMax]);

  const loadInitialData = async () => {
    try {
      const [categoriesData, typesData, yearsData] = await Promise.all([
        api.getCategories(),
        api.getTypes(),
        api.getAvailableYears(),
      ]);
      setCategories(categoriesData);
      setTypes(typesData);
      setYears(yearsData);
      if (yearsData.length > 0) {
        setFilterYear(yearsData[0]);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions({
        year: filterYear,
        month: filterMonth,
        type: filterType || undefined,
        category: filterCategory || undefined,
        amount_min: filterAmountMin ? parseFloat(filterAmountMin) : undefined,
        amount_max: filterAmountMax ? parseFloat(filterAmountMax) : undefined,
        limit: 1000,
      });
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!ubsFile && !ccFile) {
      alert('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    try {
      const result = await api.uploadFiles(ubsFile || undefined, ccFile || undefined);
      alert(`Upload successful! ${JSON.stringify(result.stats)}`);
      setUbsFile(null);
      setCcFile(null);
      if (ubsFileRef.current) ubsFileRef.current.value = '';
      if (ccFileRef.current) ccFileRef.current.value = '';
      await loadInitialData();
      await loadTransactions();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please check the file format.');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditValues({ type: transaction.type, category: transaction.category });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ type: '', category: '' });
  };

  const saveEdit = async (id: number) => {
    try {
      await api.updateTransaction(id, editValues);
      setTransactions(
        transactions.map((t) =>
          t.id === id ? { ...t, ...editValues } : t
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update transaction:', error);
      alert('Failed to update transaction');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await api.deleteTransaction(id);
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction');
    }
  };

  const getCategoriesForType = (type: string): string[] => {
    const categoryInfo = categories.find((c) => c.type === type);
    return categoryInfo?.categories || [];
  };

  const clearFilters = () => {
    setFilterMonth(undefined);
    setFilterType('');
    setFilterCategory('');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setSearchTerm('');
  };

  const filteredTransactions = transactions.filter((t) =>
    searchTerm
      ? t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(amount);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Income':
        return 'bg-green-100 text-green-800';
      case 'Expenses':
        return 'bg-red-100 text-red-800';
      case 'Savings':
        return 'bg-blue-100 text-blue-800';
      case 'CC_Refund':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-blue-600" />
          Upload CSV Files
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UBS Bank Statement (CSV)
            </label>
            <input
              ref={ubsFileRef}
              type="file"
              accept=".csv"
              onChange={(e) => setUbsFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {ubsFile && (
              <p className="mt-1 text-sm text-green-600">Selected: {ubsFile.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Card Invoice (CSV)
            </label>
            <input
              ref={ccFileRef}
              type="file"
              accept=".csv"
              onChange={(e) => setCcFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {ccFile && (
              <p className="mt-1 text-sm text-green-600">Selected: {ccFile.name}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || (!ubsFile && !ccFile)}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload & Process
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              value={filterYear || ''}
              onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select
              value={filterMonth || ''}
              onChange={(e) => setFilterMonth(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
            >
              <option value="">All Categories</option>
              {categories.flatMap((c) => c.categories).filter((v, i, a) => a.indexOf(v) === i).sort().map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Amount</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filterAmountMin}
              onChange={(e) => setFilterAmountMin(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Amount</label>
            <input
              type="number"
              step="0.01"
              placeholder="9999.99"
              value={filterAmountMax}
              onChange={(e) => setFilterAmountMax(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-5 flex gap-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
            <button
              onClick={loadTransactions}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Transactions ({filteredTransactions.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            Loading transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions found. Upload CSV files to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === transaction.id ? (
                        <select
                          value={editValues.type}
                          onChange={(e) => {
                            setEditValues({
                              type: e.target.value,
                              category: getCategoriesForType(e.target.value)[0] || '',
                            });
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          {types.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(
                            transaction.type
                          )}`}
                        >
                          {transaction.type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === transaction.id ? (
                        <select
                          value={editValues.category}
                          onChange={(e) =>
                            setEditValues({ ...editValues, category: e.target.value })
                          }
                          className="px-2 py-1 text-sm border border-gray-300 rounded max-w-[150px]"
                        >
                          {getCategoriesForType(editValues.type).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="Uncategorized">Uncategorized</option>
                        </select>
                      ) : (
                        <span className="text-sm text-gray-900">{transaction.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium whitespace-nowrap">
                      {formatAmount(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{transaction.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === transaction.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(transaction.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(transaction)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
