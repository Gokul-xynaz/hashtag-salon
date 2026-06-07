import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataProvider';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './v2/pages/Login';
import V2Dashboard from './v2/pages/Dashboard/index';
import V2QuickSale from './v2/pages/QuickSale/index';
import V2Calendar from './v2/pages/Calendar/index';
import V2Products from './v2/pages/Products/index';
import Suppliers from './v2/pages/Inventory/Suppliers';
import InventorySettings from './v2/pages/Inventory/Settings';
import V2Customers from './v2/pages/Customers/index';
import CustomerDetail from './v2/pages/Customers/CustomerDetail';
import ManageStaff from './v2/pages/Staff/index';
import StaffDetail from './v2/pages/Staff/StaffDetail';
import StaffCommissions from './v2/pages/Staff/Commissions';
import StaffPayroll from './v2/pages/Staff/Payroll';
import StaffSchedule from './v2/pages/Staff/Schedule';

import OnlineBooking from './v2/pages/Booking/OnlineBooking';
import BusinessDetails from './v2/pages/Catalogue/BusinessDetails';
import Services from './v2/pages/Catalogue/Services';
import Packages from './v2/pages/Catalogue/Packages';
import Memberships from './v2/pages/Catalogue/Memberships';
import CalendarSettings from './v2/pages/Catalogue/CalendarSettings';
import V2Reports from './v2/pages/Reports/index';
import ReportViewer from './v2/pages/Reports/ReportViewer';
import AppointmentsLedger from './v2/pages/Appointments/index';
import IntegrationsSettings from './v2/pages/Settings/Integrations';
import MarketingHub from './v2/pages/Marketing/index';
import V2Expenses from './v2/pages/Expenses/index';
import Promotions from './v2/pages/Promotions/index';
import NotFound from './v2/pages/NotFound';
import ErrorBoundary from './v2/components/ErrorBoundary';
import SystemLogs from './v2/pages/SystemLogs/index';
import InvoiceEditor from './v2/pages/InvoiceEditor/index';
import './App.css';
// index.css handles global styles

function DataDumper() {
  const { services } = useData();
  useEffect(() => {
    if (services && services.length > 0) {
      console.log("Found services in context, sending to local server...", services.length);
      fetch('/api/save-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(services),
      })
        .then(res => res.json())
        .then(data => console.log('Dumped services to local file:', data))
        .catch(err => console.error('Failed to dump services to local file:', err));
    }
  }, [services]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <DataDumper />
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Navigate to="/v2/dashboard" replace />
                </ProtectedRoute>
              } />


              <Route path="/v2/book" element={
                <OnlineBooking />
              } />
              <Route path="/v2/book/:stylistName" element={
                <OnlineBooking />
              } />

              <Route path="/v2/dashboard" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <V2Dashboard />
                </ProtectedRoute>
              } />

              <Route path="/v2/pos" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <V2QuickSale />
                </ProtectedRoute>
              } />

              <Route path="/v2/expenses" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']} requiredPermission="acc_expenditure">
                  <V2Expenses />
                </ProtectedRoute>
              } />

              <Route path="/v2/calendar" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <V2Calendar />
                </ProtectedRoute>
              } />

              <Route path="/v2/inventory" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <V2Products />
                </ProtectedRoute>
              } />
              <Route path="/v2/inventory/suppliers" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Suppliers />
                </ProtectedRoute>
              } />
              <Route path="/v2/inventory/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InventorySettings />
                </ProtectedRoute>
              } />

              <Route path="/v2/catalogue/business" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BusinessDetails />
                </ProtectedRoute>
              } />
              <Route path="/v2/catalogue/services" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Services />
                </ProtectedRoute>
              } />
              <Route path="/v2/catalogue/packages" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Packages />
                </ProtectedRoute>
              } />
              <Route path="/v2/catalogue/memberships" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Memberships />
                </ProtectedRoute>
              } />
              <Route path="/v2/catalogue/calendar-settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CalendarSettings />
                </ProtectedRoute>
              } />

              <Route path="/v2/customers" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <V2Customers />
                </ProtectedRoute>
              } />

              <Route path="/v2/customers/:id" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <CustomerDetail />
                </ProtectedRoute>
              } />

              <Route path="/v2/staff" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageStaff />
                </ProtectedRoute>
              } />
              <Route path="/v2/staff/payroll" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffPayroll />
                </ProtectedRoute>
              } />
              <Route path="/v2/staff/commissions" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffCommissions />
                </ProtectedRoute>
              } />
              <Route path="/v2/staff/schedule" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffSchedule />
                </ProtectedRoute>
              } />



              <Route path="/v2/staff/new" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffDetail />
                </ProtectedRoute>
              } />
              <Route path="/v2/staff/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffDetail />
                </ProtectedRoute>
              } />

              <Route path="/v2/reports" element={
                <ProtectedRoute allowedRoles={['admin']} requiredPermission="acc_reports">
                  <V2Reports />
                </ProtectedRoute>
              } />

              <Route path="/v2/reports/:reportId" element={
                <ProtectedRoute allowedRoles={['admin']} requiredPermission="acc_reports">
                  <ReportViewer />
                </ProtectedRoute>
              } />

              <Route path="/v2/marketing" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MarketingHub />
                </ProtectedRoute>
              } />

              <Route path="/v2/promotions" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Promotions />
                </ProtectedRoute>
              } />

              <Route path="/v2/settings/integrations" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <IntegrationsSettings />
                </ProtectedRoute>
              } />

              <Route path="/v2/appointments" element={
                <ProtectedRoute allowedRoles={['admin', 'stylist']}>
                  <AppointmentsLedger />
                </ProtectedRoute>
              } />

              <Route path="/v2/system-logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SystemLogs />
                </ProtectedRoute>
              } />

              <Route path="/v2/invoice-editor" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InvoiceEditor />
                </ProtectedRoute>
              } />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
