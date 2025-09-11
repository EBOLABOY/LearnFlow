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
    status: ''
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  // 防抖搜索
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
        toast.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '禁用';

    try {
      const response = await adminAPI.updateUser(userId, { status: newStatus });
      if (response.data.success) {
        toast.success(`用户${actionText}成功`);
        fetchUsers(); // 重新获取用户列表
      } else {
        toast.error(`用户${actionText}失败`);
      }
    } catch (error) {
      console.error(`用户${actionText}失败:`, error);
      toast.error(error.response?.data?.message || `用户${actionText}失败`);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await adminAPI.updateUser(userId, { role: newRole });
      if (response.data.success) {
        toast.success('用户角色更新成功');
        fetchUsers(); // 重新获取用户列表
      } else {
        toast.error('用户角色更新失败');
      }
    } catch (error) {
      console.error('用户角色更新失败:', error);
      toast.error(error.response?.data?.message || '用户角色更新失败');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`确定要删除用户 ${userEmail} 吗？此操作将禁用该用户账户。`)) {
      return;
    }

    try {
      const response = await adminAPI.deleteUser(userId);
      if (response.data.success) {
        toast.success('用户删除成功');
        fetchUsers(); // 重新获取用户列表
      } else {
        toast.error('用户删除失败');
      }
    } catch (error) {
      console.error('用户删除失败:', error);
      toast.error(error.response?.data?.message || '用户删除失败');
    }
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <AdminLayout title="用户管理">
      <div className="space-y-6">
        {/* 顶部操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
            <p className="mt-1 text-sm text-gray-500">
              管理系统用户账户和权限
            </p>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div>
              <label className="form-label">搜索用户</label>
              <input
                type="text"
                placeholder="输入邮箱搜索..."
                className="form-input"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>

            {/* 角色筛选 */}
            <div>
              <label className="form-label">用户角色</label>
              <select
                className="form-input"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <option value="">全部角色</option>
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="form-label">账户状态</label>
              <select
                className="form-input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="active">活跃</option>
                <option value="disabled">已禁用</option>
              </select>
            </div>

            {/* 每页显示数量 */}
            <div>
              <label className="form-label">每页显示</label>
              <select
                className="form-input"
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              >
                <option value={10}>10条</option>
                <option value={20}>20条</option>
                <option value={50}>50条</option>
                <option value={100}>100条</option>
              </select>
            </div>
          </div>
        </div>

        {/* 用户列表 */}
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
                      <th className="table-header-cell">用户信息</th>
                      <th className="table-header-cell">角色</th>
                      <th className="table-header-cell">状态</th>
                      <th className="table-header-cell">注册时间</th>
                      <th className="table-header-cell">最后登录</th>
                      <th className="table-header-cell">邀请码使用</th>
                      <th className="table-header-cell">操作</th>
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
                            <option value="user">普通用户</option>
                            <option value="admin">管理员</option>
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
                            <span className="text-xs text-gray-400">从未登录</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className="text-sm text-gray-600">
                            {user.invitations_used || 0} 个
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center space-x-2">
                            {/* 启用/禁用切换 */}
                            <button
                              onClick={() => handleStatusToggle(user.id, user.status)}
                              className={`text-xs px-2 py-1 rounded-md transition-colors duration-200 ${
                                user.status === 'active'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {user.status === 'active' ? '禁用' : '启用'}
                            </button>

                            {/* 删除按钮 */}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
                              disabled={user.role === 'admin' && pagination.total === 1}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        显示第 <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> 到{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span>{' '}
                        条，共 <span className="font-medium">{pagination.total}</span> 条记录
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

                        {/* 页码按钮 */}
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