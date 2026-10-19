import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.tsx';
import { router } from './routes.tsx';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}