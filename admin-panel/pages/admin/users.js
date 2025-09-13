import { useState } from 'react';
import { withAuth } from '../../lib/auth';
import { adminAPI } from '../../lib/api';
import AdminLayout from '../../layouts/AdminLayout';
import { formatDate, formatRelativeTime, getStatusStyle, getStatusText } from '../../utils/helpers';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination.jsx';
import Table from '../../components/Table.jsx';
import usePaginatedData from '../../hooks/usePaginatedData';

function AdminUsers() {
  const { data: users, loading, pagination, filters, setFilters, handlePageChange, debouncedSearch, refresh, sort, handleSort } = usePaginatedData({
    fetcher: (params) => adminAPI.getUsers(params),
    initialFilters: { page: 1, limit: 20, search: '', role: '', status: 'active' },
    dataPath: 'data.users',
    defaultSort: { key: 'created_at', direction: 'desc' }
  });

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '禁用';

    try {
      const response = await adminAPI.updateUser(userId, { status: newStatus });
      if (response.data.success) {
        toast.success(`用户${actionText}成功`);
        refresh(); // 重新获取用户列表
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
        refresh(); // 重新获取用户列表
      } else {
        toast.error('用户角色更新失败');
      }
    } catch (error) {
      console.error('用户角色更新失败:', error);
      toast.error(error.response?.data?.message || '用户角色更新失败');
    }
  };

  // Use handleStatusToggle for user status management

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
        <div className="glass-card p-4">
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
        <div className="glass-card">
          <Table
            loading={loading}
            columns={[
              {
                key: 'info',
                header: '用户信息',
                sortable: true,
                sortKey: 'email',
                width: '280px',
                render: (user) => (
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
                ),
              },
              {
                key: 'role',
                header: '角色',
                width: '120px',
                render: (user) => (
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="text-xs rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                    disabled={user.role === 'admin' && pagination.total === 1}
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                ),
              },
              {
                key: 'status',
                header: '状态',
                sortable: true,
                sortKey: 'is_active',
                width: '120px',
                render: (user) => (
                  <span className={getStatusStyle(user.status)}>{getStatusText(user.status)}</span>
                ),
              },
              {
                key: 'created_at',
                header: '注册时间',
                sortable: true,
                render: (user) => (
                  <div>
                    <p className="text-sm text-gray-900">{formatDate(user.created_at, 'YYYY-MM-DD')}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(user.created_at)}</p>
                  </div>
                ),
              },
              {
                key: 'last_login',
                header: '最后登录',
                sortKey: 'last_login_at',
                sortable: true,
                render: (user) => (
                  user.last_login ? (
                    <div>
                      <p className="text-sm text-gray-900">{formatDate(user.last_login, 'YYYY-MM-DD')}</p>
                      <p className="text-xs text-gray-500">{formatRelativeTime(user.last_login)}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">从未登录</span>
                  )
                ),
              },
              {
                key: 'invitations_used',
                header: '邀请码使用',
                width: '120px',
                render: (user) => (
                  <span className="text-sm text-gray-600">{user.invitations_used || 0} 个</span>
                ),
              },
              {
                key: 'actions',
                header: '操作',
                width: '120px',
                render: (user) => (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleStatusToggle(user.id, user.status)}
                      className="text-xs px-2 py-1 rounded-md transition-colors duration-200 bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      {user.status === 'active' ? '禁用' : '启用'}
                    </button>
                  </div>
                ),
              },
            ]}
            data={users}
            sort={sort}
            onSort={handleSort}
          />

          {!loading && pagination.totalPages > 1 && (
            <Pagination pagination={pagination} onPageChange={handlePageChange} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default withAuth(AdminUsers);
