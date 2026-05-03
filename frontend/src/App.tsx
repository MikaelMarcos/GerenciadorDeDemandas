import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetTree from './pages/AssetTree';
import ServiceForm from './pages/ServiceForm';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Users from './pages/Users';
import Profile from './pages/Profile';
import MlDataViewer from './pages/MlDataViewer';
import Inventory from './pages/Inventory';

const ProtectedRoute = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="assets" element={<AssetTree />} />
                <Route path="service" element={<ServiceForm />} />
                <Route path="reports" element={<Reports />} />
                <Route path="users" element={<Users />} />
                <Route path="ml-data" element={<MlDataViewer />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
