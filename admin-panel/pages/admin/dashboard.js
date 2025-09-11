import { useState, useEffect } from 'react';
import { withAuth } from '../../lib/auth';
import { adminAPI } from '../../lib/api';
import AdminLayout from '../../layouts/AdminLayout';
import { formatNumber, formatRelativeTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        toast.error('获取统计数据失败');
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      toast.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="仪表板">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  const userStats = stats?.users || {};
  const invitationStats = stats?.invitations || {};
  const recentActivity = stats?.activity || {};

  // 统计卡片数据
  const statCards = [
    {
      title: '总用户数',
      value: formatNumber(userStats.total || 0),
      change: `本周新增 ${userStats.newThisWeek || 0}`,
      changeType: 'positive',
      icon: '👥',
      color: 'bg-blue-500'
    },
    {
      title: '活跃用户',
      value: formatNumber(userStats.active || 0),
      change: `本周活跃 ${userStats.activeThisWeek || 0}`,
      changeType: 'positive',
      icon: '⚡',
      color: 'bg-green-500'
    },
    {
      title: '可用邀请码',
      value: formatNumber(invitationStats.active || 0),
      change: `本周创建 ${invitationStats.createdThisWeek || 0}`,
      changeType: 'neutral',
      icon: '🎫',
      color: 'bg-purple-500'
    },
    {
      title: '已使用邀请码',
      value: formatNumber(invitationStats.used || 0),
      change: `本周使用 ${invitationStats.usedThisWeek || 0}`,
      changeType: 'positive',
      icon: '✅',
      color: 'bg-orange-500'
    }
  ];

  return (
    <AdminLayout title="仪表板">
      <div className="space-y-8">
        {/* 欢迎信息 */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-sm">
          <div className="px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">欢迎回到管理后台</h1>
            <p className="mt-2 text-primary-100">
              深学助手用户和邀请码管理系统 · 最后更新: {formatRelativeTime(stats?.generatedAt)}
            </p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-lg ${card.color}`}>
                  <span className="text-2xl">{card.icon}</span>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className={`text-sm ${
                    card.changeType === 'positive' ? 'text-green-600' : 
                    card.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {card.change}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 活动概览 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 最新注册用户 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">最新注册用户</h3>
            </div>
            <div className="p-6">
              {recentActivity.recentUsers?.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.recentUsers.slice(0, 5).map((user, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(user.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">暂无最新用户</p>
              )}
            </div>
          </div>

          {/* 最新邀请码活动 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">邀请码动态</h3>
            </div>
            <div className="p-6">
              {recentActivity.recentInvitations?.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.recentInvitations.slice(0, 5).map((invitation, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-3 ${
                          invitation.used_by ? 'bg-green-400' : 'bg-blue-400'
                        }`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 font-mono">
                            {invitation.code}
                          </p>
                          <p className="text-xs text-gray-500">
                            {invitation.used_by ? `由 ${invitation.used_by} 使用` : '等待使用'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(invitation.used_at || invitation.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">暂无邀请码活动</p>
              )}
            </div>
          </div>
        </div>

        {/* 最近管理员操作 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">最近操作日志</h3>
          </div>
          <div className="p-6">
            {recentActivity.adminLogs?.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.adminLogs.slice(0, 8).map((log, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-primary-400 mr-3"></div>
                      <div>
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.admin_email}</span>
                          <span className="ml-1">{getActionText(log.action, log.target_type)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">暂无操作日志</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// 辅助函数：获取操作文本描述
function getActionText(action, targetType) {
  const actionMap = {
    'login_success': '登录成功',
    'create_invitations': '创建了邀请码',
    'revoke_invitation': '撤销了邀请码', 
    'update_user': '更新了用户信息',
    'delete_user': '删除了用户'
  };
  
  const targetMap = {
    'user': '用户',
    'invitation_code': '邀请码',
    'system': '系统'
  };

  return actionMap[action] || `执行了 ${action} 操作`;
}

export default withAuth(AdminDashboard);