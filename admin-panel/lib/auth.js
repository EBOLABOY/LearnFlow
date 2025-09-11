import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { api } from './api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = Cookies.get('admin_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // 楠岃瘉token鏈夋晥鎬?
      const response = await api.get('/admin/profile');
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        Cookies.remove('admin_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      Cookies.remove('admin_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/admin/login', { email, password });
      
      if (response.data.success) {
        const { token, user: userData } = response.data;
        
        // 璁剧疆cookie (7澶╄繃鏈?
        Cookies.set('admin_token', token, { 
          expires: 7,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        
        setUser(userData);
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || '鐧诲綍澶辫触锛岃绋嶅悗閲嶈瘯' 
      };
    }
  };

  const logout = () => {
    Cookies.remove('admin_token');
    setUser(null);
    router.push('/admin/login');
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!user && user.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 楂橀樁缁勪欢锛氫繚鎶ら渶瑕佽璇佺殑椤甸潰
export function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && (!user || user.role !== 'admin')) {
        router.replace('/admin/login');
      }
    }, [user, loading, router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!user || user.role !== 'admin') {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
