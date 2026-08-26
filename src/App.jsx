import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// PUBLIC PAGES
import Home from './pages/Home';
import Login from './pages/auth/Login';
import GetStarted from './pages/auth/GetStarted';
import Donate from './pages/dashboard/Donate';
import HomeSubscriptionPage from './pages/subscription/HomeSubscriptionPage'; // Info page for guests
import SubscriptionPage from './pages/subscription/SubscriptionPage';       // Active management page

// LAYOUTS
import DashboardLayout from './pages/dashboard/DashboardLayout';
// DASHBOARD PAGES
import SuperAdminDashboard from './pages/dashboard/SuperAdminDashboard';
import SuperAdminSettings from './pages/dashboard/SuperAdminSettings';
import SuperAdminSmsLogs from './pages/dashboard/SuperAdminSmsLogs';
import SuperAdminReports from './pages/dashboard/SuperAdminReports';
import ManualUpgrade from './pages/dashboard/ManualUpgrade';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import CreateUser from './pages/dashboard/CreateUser';
import ManageUsers from './pages/dashboard/ManageUsers';
import AssignRoles from './pages/dashboard/AssignRoles';
import Reports from './pages/dashboard/Reports';
import Settings from './pages/dashboard/Settings';
import SubscriptionSandbox from './pages/dashboard/SubscriptionSandbox';
import UpgradePlans from './pages/UpgradePlans';
import CreateFuneral from './pages/funerals/CreateFuneral';
import FuneralList from './pages/funerals/FuneralList';
import FuneralManagement from './pages/funerals/FuneralManagement';
import QRGenerator from './pages/dashboard/QRGenerator'; 
import FuneralHeadDashboard from './pages/dashboard/FuneralHeadDashboard';
import FuneralHeadReports from './pages/funerals/FuneralHeadReports';
import CashierDashboard from './pages/dashboard/CashierDashboard';
import DonationEntry from './pages/dashboard/DonationEntry';
import ReceiptSearch from './pages/dashboard/ReceiptSearch';
import SmsLogs from './pages/dashboard/SmsLogs';
import SupervisorDashboard from './pages/dashboard/SupervisorDashboard';
import ViewerDashboard from './pages/dashboard/ViewerDashboard';
import ReversalManagement from './pages/dashboard/ReversalManagement';

// GUARDS
import ProtectedRoute from './routes/ProtectedRoute';
import GlobalSubscriptionGuard from './pages/guards/GlobalSubscriptionGuard';

function App() {
  return (
    <Routes>
      {/* --- PUBLIC ROUTES --- */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/get-started" element={<GetStarted />} />
      <Route path="/subscription" element={<HomeSubscriptionPage />} />
      <Route path="/donate/:funeralId" element={<Donate />} />
      
      {/* --- PROTECTED ROUTES --- */}
      
      {/* SUPERADMIN */}
      <Route path="/superadmin" element={<ProtectedRoute allowedRole="SUPERADMIN"><DashboardLayout role="superadmin" /></ProtectedRoute>}>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="manual-upgrade" element={<ManualUpgrade />} />
        <Route path="subscriptions" element={<SubscriptionPage />} />
        <Route path="settings" element={<SuperAdminSettings />} />
        <Route path="sms-logs" element={<SuperAdminSmsLogs />} />
        <Route path="reports" element={<SuperAdminReports />} />
      </Route>

      {/* ADMIN */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="ADMIN">
          <GlobalSubscriptionGuard>
            <DashboardLayout role="admin" />
          </GlobalSubscriptionGuard>
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="create-user" element={<CreateUser />} />
        <Route path="manage-users" element={<ManageUsers />} />
        <Route path="assign-role" element={<AssignRoles />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="upgrade" element={<UpgradePlans />} />
        <Route path="test-panel" element={<SubscriptionSandbox />} />
        <Route path="funerals/create" element={<CreateFuneral />} />
        <Route path="funerals" element={<FuneralList />} />
        <Route path="funerals/manage" element={<FuneralManagement />} />
        <Route path="qr-generator" element={<QRGenerator />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* FUNERAL HEAD, CASHIER, SUPERVISOR, VIEWER (Omitted similar for brevity) */}
      <Route path="/funeralhead" element={<ProtectedRoute allowedRole="FUNERALHEAD"><GlobalSubscriptionGuard><DashboardLayout role="funeralhead" /></GlobalSubscriptionGuard></ProtectedRoute>}>
        <Route index element={<FuneralHeadDashboard />} />
        <Route path="reports" element={<FuneralHeadReports />} />
      </Route>

      <Route path="/cashier" element={<ProtectedRoute allowedRole="CASHIER"><GlobalSubscriptionGuard><DashboardLayout role="cashier" /></GlobalSubscriptionGuard></ProtectedRoute>}>
        <Route index element={<CashierDashboard />} />
        <Route path="donations" element={<DonationEntry />} />
        <Route path="receipts" element={<ReceiptSearch />} />
        <Route path="reports" element={<Reports />} />
        <Route path="sms" element={<SmsLogs />} />
      </Route>

      <Route path="/supervisor" element={<ProtectedRoute allowedRole="SUPERVISOR"><GlobalSubscriptionGuard><DashboardLayout role="supervisor" /></GlobalSubscriptionGuard></ProtectedRoute>}>
        <Route index element={<SupervisorDashboard />} />
        <Route path="donations" element={<DonationEntry />} />
        <Route path="receipts" element={<ReceiptSearch />} />
        <Route path="reversals" element={<ReversalManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="sms" element={<SmsLogs />} />
      </Route>

      <Route path="/viewer" element={<ProtectedRoute allowedRole="VIEWER"><GlobalSubscriptionGuard><DashboardLayout role="viewer" /></GlobalSubscriptionGuard></ProtectedRoute>}>
        <Route index element={<ViewerDashboard />} />
        <Route path="reports" element={<Reports />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
