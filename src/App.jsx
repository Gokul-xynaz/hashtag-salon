import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataProvider';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ErrorBoundary from './v2/components/ErrorBoundary';

const Login = React.lazy(() => import('./v2/pages/Login'));
const V2Dashboard = React.lazy(() => import('./v2/pages/Dashboard/index'));
const V2QuickSale = React.lazy(() => import('./v2/pages/QuickSale/index'));
const V2Calendar = React.lazy(() => import('./v2/pages/Calendar/index'));
const V2Products = React.lazy(() => import('./v2/pages/Products/index'));
const Suppliers = React.lazy(() => import('./v2/pages/Inventory/Suppliers'));
const InventorySettings = React.lazy(() => import('./v2/pages/Inventory/Settings'));
const V2Customers = React.lazy(() => import('./v2/pages/Customers/index'));
const CustomerDetail = React.lazy(() => import('./v2/pages/Customers/CustomerDetail'));
const ManageStaff = React.lazy(() => import('./v2/pages/Staff/index'));
const StaffDetail = React.lazy(() => import('./v2/pages/Staff/StaffDetail'));
const StaffCommissions = React.lazy(() => import('./v2/pages/Staff/Commissions'));
const StaffPayroll = React.lazy(() => import('./v2/pages/Staff/Payroll'));
const StaffSchedule = React.lazy(() => import('./v2/pages/Staff/Schedule'));

const OnlineBooking = React.lazy(() => import('./v2/pages/Booking/OnlineBooking'));
const BusinessDetails = React.lazy(() => import('./v2/pages/Catalogue/BusinessDetails'));
const Services = React.lazy(() => import('./v2/pages/Catalogue/Services'));
const Packages = React.lazy(() => import('./v2/pages/Catalogue/Packages'));
const Memberships = React.lazy(() => import('./v2/pages/Catalogue/Memberships'));
const CalendarSettings = React.lazy(() => import('./v2/pages/Catalogue/CalendarSettings'));
const V2Reports = React.lazy(() => import('./v2/pages/Reports/index'));
const ReportViewer = React.lazy(() => import('./v2/pages/Reports/ReportViewer'));
const AppointmentsLedger = React.lazy(() => import('./v2/pages/Appointments/index'));
const IntegrationsSettings = React.lazy(() => import('./v2/pages/Settings/Integrations'));
const MarketingHub = React.lazy(() => import('./v2/pages/Marketing/index'));
const V2Expenses = React.lazy(() => import('./v2/pages/Expenses/index'));
const Promotions = React.lazy(() => import('./v2/pages/Promotions/index'));
const NotFound = React.lazy(() => import('./v2/pages/NotFound'));
const SystemLogs = React.lazy(() => import('./v2/pages/SystemLogs/index'));
const InvoiceEditor = React.lazy(() => import('./v2/pages/InvoiceEditor/index'));

import './App.css';
// index.css handles global styles

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
    <div style={{ padding: '20px', borderRadius: '12px', background: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      Loading...
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
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
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
