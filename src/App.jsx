import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataProvider';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import ButtonBack from './components/common/ButtonBack';
import './App.css';

// Lazy load components for code splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ServiceManager = lazy(() => import('./components/admin/ServiceManager'));
const ExpenseTracker = lazy(() => import('./components/admin/ExpenseTracker'));
const TeamManager = lazy(() => import('./components/admin/TeamManager'));
const Reports = lazy(() => import('./components/admin/Reports'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const InventoryManager = lazy(() => import('./components/admin/InventoryManager'));
const NewBooking = lazy(() => import('./pages/NewBooking'));
const CustomerManager = lazy(() => import('./components/admin/CustomerManager'));

// Premium SaaS Loader
const AppLoader = () => (
  <div className="saas-loader-container">
    <div className="saas-spinner"></div>
    <div className="saas-loading-text">Loading Workspace</div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Suspense fallback={<AppLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />

              <Route path="/admin/services" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <ServiceManager />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/expenses" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <ExpenseTracker />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/team" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <TeamManager />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <Reports />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <AdminSettings />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/inventory" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <InventoryManager />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/admin/customers" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <div style={{ marginBottom: '2rem' }}>
                      <ButtonBack />
                    </div>
                    <CustomerManager />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="/booking/new" element={
                <ProtectedRoute allowedRoles={['stylist']}>
                  <div style={{ marginTop: '2rem' }}>
                    <NewBooking />
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DataProvider >
    </AuthProvider >
  );
}

export default App;
