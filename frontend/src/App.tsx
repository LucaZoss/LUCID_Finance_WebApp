import { useState, useEffect, useRef } from 'react';
import { Upload, PieChart, Calculator, Menu, X, LogOut, User, Filter, Download, ChevronDown, Users } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TransactionsPage from './pages/TransactionsPage';
import BudgetPlanningPage from './pages/BudgetPlanningPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RulesPage from './pages/RulesPage';
import UserManagementPage from './pages/UserManagementPage';
import { downloadExcel, getAvailableYears } from './api';

type Page = 'transactions' | 'planning' | 'dashboard' | 'rules' | 'user-management';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState<number | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Load available years
  useEffect(() => {
    if (isAuthenticated) {
      getAvailableYears().then(setAvailableYears).catch(console.error);
    }
  }, [isAuthenticated]);

  // Handle Excel export
  const handleExport = async () => {
    try {
      setDownloading(true);
      await downloadExcel(exportYear, exportMonth);
      setExportModalOpen(false);
      setUserMenuOpen(false);
    } catch (error) {
      console.error('Failed to download Excel:', error);
      alert('Failed to download Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: PieChart },
    { id: 'transactions' as Page, label: 'Transactions', icon: Upload },
    { id: 'planning' as Page, label: 'Budget Planning', icon: Calculator },
    { id: 'rules' as Page, label: 'Rules', icon: Filter },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'transactions':
        return <TransactionsPage />;
      case 'planning':
        return <BudgetPlanningPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'rules':
        return <RulesPage />;
      case 'user-management':
        return <UserManagementPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600">LUCID Finance</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <nav className="flex space-x-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === item.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* User menu */}
              <div className="relative pl-4 border-l border-gray-200" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user?.username}</span>
                  {user?.is_admin && (
                    <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      Admin
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {user?.is_admin && (
                      <>
                        <button
                          onClick={() => {
                            setCurrentPage('user-management');
                            setUserMenuOpen(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          User Management
                        </button>
                        <div className="border-t border-gray-200 my-1"></div>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setExportModalOpen(true);
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              ))}

              {/* User info and actions */}
              <div className="pt-2 mt-2 border-t border-gray-200">
                <div className="px-4 py-2 text-sm text-gray-700">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    <span className="font-medium">{user?.username}</span>
                    {user?.is_admin && (
                      <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                {user?.is_admin && (
                  <button
                    onClick={() => {
                      setCurrentPage('user-management');
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    User Management
                  </button>
                )}
                <button
                  onClick={() => {
                    setExportModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </button>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>

      {/* Export Excel Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Export to Excel</h2>

            <div className="space-y-4">
              {/* Year Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month (optional)
                </label>
                <select
                  value={exportMonth ?? ''}
                  onChange={(e) => setExportMonth(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Year</option>
                  {['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-gray-600">
                The Excel file will include two sheets:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Budget vs Actual breakdown by category</li>
                <li>All categorized transactions</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setExportModalOpen(false)}
                disabled={downloading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={downloading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
