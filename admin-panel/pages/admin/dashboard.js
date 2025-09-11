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
        toast.error('鑾峰彇缁熻鏁版嵁澶辫触');
      }
    } catch (error) {
      console.error('鑾峰彇缁熻鏁版嵁澶辫触:', error);
      toast.error('鑾峰彇缁熻鏁版嵁澶辫触');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  const userStats = stats?.users || {};
  const invitationStats = stats?.invitations || {};
  const recentActivity = stats?.activity || {};

  // 缁熻鍗＄墖鏁版嵁
  const statCards = [
    {
      title: '鎬荤敤鎴锋暟',
      value: formatNumber(userStats.total || 0),
      change: `鏈懆鏂板 ${userStats.newThisWeek || 0}`,
      changeType: 'positive',
      icon: '馃懃',
      color: 'bg-blue-500'
    },
    {
      title: '娲昏穬鐢ㄦ埛',
      value: formatNumber(userStats.active || 0),
      change: `鏈懆娲昏穬 ${userStats.activeThisWeek || 0}`,
      changeType: 'positive',
      icon: '*',
      color: 'bg-green-500'
    },
    {
      title: '鍙敤閭€璇风爜',
      value: formatNumber(invitationStats.active || 0),
      change: `鏈懆鍒涘缓 ${invitationStats.createdThisWeek || 0}`,
      changeType: 'neutral',
      icon: '馃帿',
      color: 'bg-purple-500'
    },
    {
      title: '宸蹭娇鐢ㄩ個璇风爜',
      value: formatNumber(invitationStats.used || 0),
      change: `鏈懆浣跨敤 ${invitationStats.usedThisWeek || 0}`,
      changeType: 'positive',
      icon: '*',
      color: 'bg-orange-500'
    }
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-8">
        {/* 娆㈣繋淇℃伅 */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-sm">
          <div className="px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">娆㈣繋鍥炲埌绠＄悊鍚庡彴</h1>
            <p className="mt-2 text-primary-100">
              娣卞鍔╂墜鐢ㄦ埛鍜岄個璇风爜绠＄悊绯荤粺 路 鏈€鍚庢洿鏂? {formatRelativeTime(stats?.generatedAt)}
            </p>
          </div>
        </div>

        {/* 缁熻鍗＄墖 */}
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

        {/* 娲诲姩姒傝 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 鏈€鏂版敞鍐岀敤鎴?*/}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">鏈€鏂版敞鍐岀敤鎴?/h3>
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
                            {user.role === 'admin' ? '绠＄悊鍛? : '鏅€氱敤鎴?}
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
                <p className="text-gray-500 text-center py-4">鏆傛棤鏈€鏂扮敤鎴?/p>
              )}
            </div>
          </div>

          {/* 鏈€鏂伴個璇风爜娲诲姩 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">閭€璇风爜鍔ㄦ€?/h3>
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
                            {invitation.used_by ? `鐢?${invitation.used_by} 浣跨敤` : '绛夊緟浣跨敤'}
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
                <p className="text-gray-500 text-center py-4">鏆傛棤閭€璇风爜娲诲姩</p>
              )}
            </div>
          </div>
        </div>

        {/* 鏈€杩戠鐞嗗憳鎿嶄綔 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">鏈€杩戞搷浣滄棩蹇?/h3>
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
              <p className="text-gray-500 text-center py-4">鏆傛棤鎿嶄綔鏃ュ織</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// 杈呭姪鍑芥暟锛氳幏鍙栨搷浣滄枃鏈弿杩?
function getActionText(action) {
  const actionMap = {
    login_success: 'Login successful',
    create_invitations: 'Created invitations',
    revoke_invitation: 'Revoked invitation',
    update_user: 'Updated user info',
    delete_user: 'Deleted user'
  };

  return actionMap[action] || `Performed ${action}`;
}

export default withAuth(AdminDashboard);
