import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { setRouter } from '../lib/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  useEffect(() => {
    // Expose the Next.js router to non-component modules
    setRouter(router);
  }, [router]);
  return (
    <AuthProvider>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}
