import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataProvider';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceManager from './components/admin/ServiceManager';
import ExpenseTracker from './components/admin/ExpenseTracker';
import DatabaseSeeder from './components/admin/DatabaseSeeder';
import TeamManager from './components/admin/TeamManager';
import Reports from './components/admin/Reports';
import AdminSettings from './components/admin/AdminSettings';
import InventoryManager from './components/admin/InventoryManager';
import NewBooking from './pages/NewBooking';
import CustomerManager from './components/admin/CustomerManager';
import ButtonBack from './components/common/ButtonBack';
import './App.css';
// index.css handles global styles

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/seed" element={<DatabaseSeeder />} />

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
        </BrowserRouter>
      </DataProvider >
    </AuthProvider >
  );
}

export default App;
