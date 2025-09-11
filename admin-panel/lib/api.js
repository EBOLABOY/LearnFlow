import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://learn-flow-ashy.vercel.app/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理通用错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 处理认证错误
    if (error.response?.status === 401) {
      Cookies.remove('admin_token');
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
      return Promise.reject(error);
    }

    // 处理网络错误
    if (!error.response) {
      toast.error('网络连接失败，请检查网络设置');
      return Promise.reject(error);
    }

    // 处理服务器错误
    if (error.response.status >= 500) {
      toast.error('服务器暂时无法响应，请稍后重试');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// API方法封装
export const adminAPI = {
  // 认证相关
  login: (email, password) => api.post('/admin/login', { email, password }),
  getProfile: () => api.get('/admin/profile'),
  
  // 用户管理
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  
  // 邀请码管理
  getInvitations: (params = {}) => api.get('/admin/invitations', { params }),
  createInvitations: (data) => api.post('/admin/invitations', data),
  revokeInvitation: (id) => api.delete(`/admin/invitations/${id}`),
  
  // 系统统计
  getStats: () => api.get('/admin/stats'),
  
  // 操作日志
  getLogs: (params = {}) => api.get('/admin/logs', { params }),
};

export { api };
export default api;