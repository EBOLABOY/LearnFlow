import { useState, useEffect } from 'react';
import { withAuth } from '../../lib/auth';
import { adminAPI } from '../../lib/api';
import AdminLayout from '../../layouts/AdminLayout';
import { formatDate, formatRelativeTime, getStatusStyle, getStatusText, debounce } from '../../utils/helpers';
import toast from 'react-hot-toast';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    role: '',
    status: 'active'
  });

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  // 闃叉姈鎼滅储
  const debouncedSearch = debounce((searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  }, 500);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getUsers(filters);
      if (response.data.success) {
        setUsers(response.data.data.users);
        setPagination(response.data.data.pagination);
      } else {
        toast.error('鑾峰彇鐢ㄦ埛鍒楄〃澶辫触');
      }
    } catch (error) {
      console.error('鑾峰彇鐢ㄦ埛鍒楄〃澶辫触:', error);
      toast.error('鑾峰彇鐢ㄦ埛鍒楄〃澶辫触');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '鍚敤' : '绂佺敤';

    try {
      const response = await adminAPI.updateUser(userId, { status: newStatus });
      if (response.data.success) {
        toast.success(`鐢ㄦ埛${actionText}鎴愬姛`);
        fetchUsers(); // 閲嶆柊鑾峰彇鐢ㄦ埛鍒楄〃
      } else {
        toast.error(`鐢ㄦ埛${actionText}澶辫触`);
      }
    } catch (error) {
      console.error(`鐢ㄦ埛${actionText}澶辫触:`, error);
      toast.error(error.response?.data?.message || `鐢ㄦ埛${actionText}澶辫触`);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await adminAPI.updateUser(userId, { role: newRole });
      if (response.data.success) {
        toast.success('鐢ㄦ埛瑙掕壊鏇存柊鎴愬姛');
        fetchUsers(); // 閲嶆柊鑾峰彇鐢ㄦ埛鍒楄〃
      } else {
        toast.error('鐢ㄦ埛瑙掕壊鏇存柊澶辫触');
      }
    } catch (error) {
      console.error('鐢ㄦ埛瑙掕壊鏇存柊澶辫触:', error);
      toast.error(error.response?.data?.message || '鐢ㄦ埛瑙掕壊鏇存柊澶辫触');
    }
  };

  // 绂佺敤鐢ㄦ埛锛堣蒋禁用锛?  
const handleDisableUser = async (userId, userEmail) => {
    if (!confirm(`纭瑕佺鐢ㄧ敤鎴?${userEmail} 鍚楋紵姝ゆ搷浣滃皢鍋滅敤璇ヨ处鍙枫€俙)) {
      return;
    }

    try {
      const response = await adminAPI.deleteUser(userId);
      if (response.data.success) {
        toast.success('鐢ㄦ埛宸茬鐢?);
        fetchUsers();
      } else {
        toast.error('绂佺敤澶辫触');
      }
    } catch (error) {
      console.error('绂佺敤澶辫触:', error);
      toast.error(error.response?.data?.message || '绂佺敤澶辫触');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`纭畾瑕佸垹闄ょ敤鎴?${userEmail} 鍚楋紵姝ゆ搷浣滃皢绂佺敤璇ョ敤鎴疯处鎴枫€俙)) {
      return;
    }

    try {
      const response = await adminAPI.deleteUser(userId);
      if (response.data.success) {
        toast.success('鐢ㄦ埛禁用鎴愬姛');
        fetchUsers(); // 閲嶆柊鑾峰彇鐢ㄦ埛鍒楄〃
      } else {
        toast.error('鐢ㄦ埛禁用澶辫触');
      }
    } catch (error) {
      console.error('鐢ㄦ埛禁用澶辫触:', error);
      toast.error(error.response?.data?.message || '鐢ㄦ埛禁用澶辫触');
    }
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <AdminLayout title="鐢ㄦ埛绠＄悊">
      <div className="space-y-6">
        {/* 椤堕儴鎿嶄綔鏍?*/}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">鐢ㄦ埛绠＄悊</h2>
            <p className="mt-1 text-sm text-gray-500">
              绠＄悊绯荤粺鐢ㄦ埛璐︽埛鍜屾潈闄?
            </p>
          </div>
        </div>

        {/* 绛涢€夊櫒 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 鎼滅储妗?*/}
            <div>
              <label className="form-label">鎼滅储鐢ㄦ埛</label>
              <input
                type="text"
                placeholder="杈撳叆閭鎼滅储..."
                className="form-input"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>

            {/* 瑙掕壊绛涢€?*/}
            <div>
              <label className="form-label">鐢ㄦ埛瑙掕壊</label>
              <select
                className="form-input"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <option value="">鍏ㄩ儴瑙掕壊</option>
                <option value="user">鏅€氱敤鎴?/option>
                <option value="admin">绠＄悊鍛?/option>
              </select>
            </div>

            {/* 鐘舵€佺瓫閫?*/}
            <div>
              <label className="form-label">璐︽埛鐘舵€?/label>
              <select
                className="form-input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">鍏ㄩ儴鐘舵€?/option>
                <option value="active">娲昏穬</option>
                <option value="disabled">宸茬鐢?/option>
              </select>
            </div>

            {/* 姣忛〉鏄剧ず鏁伴噺 */}
            <div>
              <label className="form-label">姣忛〉鏄剧ず</label>
              <select
                className="form-input"
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              >
                <option value={10}>10鏉?/option>
                <option value={20}>20鏉?/option>
                <option value={50}>50鏉?/option>
                <option value={100}>100鏉?/option>
              </select>
            </div>
          </div>
        </div>

        {/* 鐢ㄦ埛鍒楄〃 */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">鐢ㄦ埛淇℃伅</th>
                      <th className="table-header-cell">瑙掕壊</th>
                      <th className="table-header-cell">鐘舵€?/th>
                      <th className="table-header-cell">娉ㄥ唽鏃堕棿</th>
                      <th className="table-header-cell">鏈€鍚庣櫥褰?/th>
                      <th className="table-header-cell">閭€璇风爜浣跨敤</th>
                      <th className="table-header-cell">鎿嶄綔</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="table-cell">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{user.email}</p>
                              <p className="text-xs text-gray-500">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="text-xs rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                            disabled={user.role === 'admin' && pagination.total === 1}
                          >
                            <option value="user">鏅€氱敤鎴?/option>
                            <option value="admin">绠＄悊鍛?/option>
                          </select>
                        </td>
                        <td className="table-cell">
                          <span className={getStatusStyle(user.status)}>
                            {getStatusText(user.status)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div>
                            <p className="text-sm text-gray-900">{formatDate(user.created_at, 'YYYY-MM-DD')}</p>
                            <p className="text-xs text-gray-500">{formatRelativeTime(user.created_at)}</p>
                          </div>
                        </td>
                        <td className="table-cell">
                          {user.last_login ? (
                            <div>
                              <p className="text-sm text-gray-900">{formatDate(user.last_login, 'YYYY-MM-DD')}</p>
                              <p className="text-xs text-gray-500">{formatRelativeTime(user.last_login)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">浠庢湭鐧诲綍</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className="text-sm text-gray-600">
                            {user.invitations_used || 0} 涓?
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center space-x-2">
                            {/* 鍚敤/绂佺敤鍒囨崲 */}
                            <button
                              onClick={() => handleStatusToggle(user.id, user.status)}
                              className={`text-xs px-2 py-1 rounded-md transition-colors duration-200 ${
                                user.status === 'active'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {user.status === 'active' ? '绂佺敤' : '鍚敤'}
                            </button>

                            {/* 禁用鎸夐挳 */}
                            <button
                              onClick={() => handleDisableUser(user.id, user.email)}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
                              disabled={user.status !== 'active' || (user.role === 'admin' && pagination.total === 1)}
                            >
                              禁用
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 鍒嗛〉 */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      涓婁竴椤?
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      涓嬩竴椤?
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        鏄剧ず绗?<span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> 鍒皗' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span>{' '}
                        鏉★紝鍏?<span className="font-medium">{pagination.total}</span> 鏉¤褰?
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.hasPrev}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {/* 椤电爜鎸夐挳 */}
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, pagination.page - 2) + i;
                          if (pageNum > pagination.totalPages) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === pagination.page
                                  ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.hasNext}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default withAuth(AdminUsers);

