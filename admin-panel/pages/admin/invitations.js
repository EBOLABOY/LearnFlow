import { useState, useEffect, useCallback } from 'react';
import { withAuth } from '../../lib/auth';
import { adminAPI } from '../../lib/api';
import AdminLayout from '../../layouts/AdminLayout';
import { formatDate, formatRelativeTime, getStatusStyle, getStatusText, copyToClipboard, debounce } from '../../utils/helpers';
import toast from 'react-hot-toast';

function AdminInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: ''
  });
  const [createForm, setCreateForm] = useState({
    count: 1,
    expiryDays: 30
  });

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // 防抖搜索
  const debouncedSearch = debounce((searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  }, 500);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getInvitations(filters);
      if (response.data.success) {
        setInvitations(response.data.data.invitations);
        setPagination(response.data.data.pagination);
      } else {
        toast.error('获取邀请码列表失败');
      }
    } catch (error) {
      console.error('获取邀请码列表失败:', error);
      toast.error('获取邀请码列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleCreateInvitations = async (e) => {
    e.preventDefault();
    
    if (createForm.count < 1 || createForm.count > 100) {
      toast.error('生成数量必须在1-100之间');
      return;
    }

    if (createForm.expiryDays < 1 || createForm.expiryDays > 365) {
      toast.error('有效期必须在1-365天之间');
      return;
    }

    try {
      setCreating(true);
      const response = await adminAPI.createInvitations(createForm);
      if (response.data.success) {
        toast.success(`成功生成${response.data.data.count}个邀请码`);
        setShowCreateModal(false);
        setCreateForm({ count: 1, expiryDays: 30 });
        fetchInvitations(); // 重新获取列表
      } else {
        toast.error('生成邀请码失败');
      }
    } catch (error) {
      console.error('生成邀请码失败:', error);
      toast.error(error.response?.data?.message || '生成邀请码失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeInvitation = async (invitationId, code) => {
    if (!confirm(`确定要撤销邀请码 ${code} 吗？此操作无法撤销。`)) {
      return;
    }

    try {
      const response = await adminAPI.revokeInvitation(invitationId);
      if (response.data.success) {
        toast.success('邀请码撤销成功');
        fetchInvitations(); // 重新获取列表
      } else {
        toast.error('邀请码撤销失败');
      }
    } catch (error) {
      console.error('邀请码撤销失败:', error);
      toast.error(error.response?.data?.message || '邀请码撤销失败');
    }
  };

  const handleCopyCode = async (code) => {
    const success = await copyToClipboard(code);
    if (success) {
      toast.success('邀请码已复制到剪贴板');
    } else {
      toast.error('复制失败，请手动复制');
    }
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const getInvitationStatus = (invitation) => {
    if (invitation.used_by_email) return 'used';
    if (new Date(invitation.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <AdminLayout title="邀请码管理">
      <div className="space-y-6">
        {/* 顶部操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">邀请码管理</h2>
            <p className="mt-1 text-sm text-gray-500">
              创建和管理用户注册邀请码
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              生成邀请码
            </button>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div>
              <label className="form-label">搜索邀请码</label>
              <input
                type="text"
                placeholder="输入邀请码搜索..."
                className="form-input"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="form-label">邀请码状态</label>
              <select
                className="form-input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="active">可用</option>
                <option value="used">已使用</option>
                <option value="expired">已过期</option>
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

            {/* 刷新按钮 */}
            <div className="flex items-end">
              <button
                onClick={fetchInvitations}
                disabled={loading}
                className="btn btn-secondary w-full"
              >
                {loading ? '加载中...' : '刷新列表'}
              </button>
            </div>
          </div>
        </div>

        {/* 邀请码列表 */}
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
                      <th className="table-header-cell">邀请码</th>
                      <th className="table-header-cell">状态</th>
                      <th className="table-header-cell">创建者</th>
                      <th className="table-header-cell">使用者</th>
                      <th className="table-header-cell">过期时间</th>
                      <th className="table-header-cell">创建时间</th>
                      <th className="table-header-cell">操作</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {invitations.map((invitation) => {
                      const status = getInvitationStatus(invitation);
                      return (
                        <tr key={invitation.id}>
                          <td className="table-cell">
                            <div className="flex items-center">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                {invitation.code}
                              </code>
                              <button
                                onClick={() => handleCopyCode(invitation.code)}
                                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                title="复制邀请码"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="table-cell">
                            <span className={getStatusStyle(status)}>
                              {getStatusText(status)}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm text-gray-900">
                              {invitation.created_by_email}
                            </span>
                          </td>
                          <td className="table-cell">
                            {invitation.used_by_email ? (
                              <div>
                                <p className="text-sm text-gray-900">{invitation.used_by_email}</p>
                                <p className="text-xs text-gray-500">{formatRelativeTime(invitation.used_at)}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">未使用</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <div>
                              <p className="text-sm text-gray-900">{formatDate(invitation.expires_at, 'YYYY-MM-DD')}</p>
                              <p className="text-xs text-red-500">{new Date(invitation.expires_at) < new Date() ? formatRelativeTime(invitation.expires_at) : formatRelativeTime(invitation.expires_at)}</p>
                            </div>
                          </td>
                          <td className="table-cell">
                            <div>
                              <p className="text-sm text-gray-900">{formatDate(invitation.created_at, 'YYYY-MM-DD')}</p>
                              <p className="text-xs text-gray-500">{formatRelativeTime(invitation.created_at)}</p>
                            </div>
                          </td>
                          <td className="table-cell">
                            {status === 'active' && (
                              <button
                                onClick={() => handleRevokeInvitation(invitation.id, invitation.code)}
                                className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors duration-200"
                              >
                                撤销
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

      {/* 创建邀请码模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateInvitations}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        生成邀请码
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="form-label">生成数量</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={createForm.count}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                            className="form-input"
                            placeholder="输入生成数量 (1-100)"
                            required
                          />
                          <p className="mt-1 text-xs text-gray-500">一次最多可生成100个邀请码</p>
                        </div>

                        <div>
                          <label className="form-label">有效期（天）</label>
                          <select
                            value={createForm.expiryDays}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, expiryDays: parseInt(e.target.value) }))}
                            className="form-input"
                            required
                          >
                            <option value={7}>7天</option>
                            <option value={15}>15天</option>
                            <option value={30}>30天</option>
                            <option value={60}>60天</option>
                            <option value={90}>90天</option>
                            <option value={180}>180天</option>
                            <option value={365}>365天</option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500">邀请码过期后将自动失效</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <div className="flex items-center">
                        <div className="loading-spinner mr-2"></div>
                        生成中...
                      </div>
                    ) : (
                      '确认生成'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default withAuth(AdminInvitations);