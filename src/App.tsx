import { useLocation, BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { InstallAppBanner } from './components/InstallAppBanner';
import { EmployerLandingPage } from './pages/EmployerLandingPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { CTVLandingPage } from './pages/ctv/CTVLandingPage';
import { CTVRegistrationPage } from './pages/ctv/CTVRegistrationPage';
import { AccountPage } from './pages/AccountPage';
import CandidateProfilePage from './pages/CandidateProfilePage';
import CTVProfilePage from './pages/profile/CTVProfilePage';
import CompanyProfilePage from './pages/profile/CompanyProfilePage';
import Chatbot from './components/Chatbot';
import { CTVDashboardPage } from './pages/ctv/CTVDashboardPage';
import { CTVCampaignsPage } from './pages/ctv/CTVCampaignsPage';
import { CompanyDashboardPage } from './pages/company/CompanyDashboardPage';
import { AdminConsolePage } from './pages/admin/AdminConsolePage';
import { CTVRoute, CompanyRoute, ForbiddenPage } from './components/RouteGuard';
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { DataDeletionPage } from './pages/legal/DataDeletionPage';

function AppContent() {
  const location = useLocation();
  const hideChatbot = location.pathname === '/privacy-policy' || location.pathname === '/data-deletion';

  return (
    <div className="min-h-screen bg-brand-surface text-slate-900">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/viec-lam" element={<JobsPage />} />
        <Route path="/viec-lam/:slug" element={<JobDetailPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />

        <Route path="/nha-tuyen-dung" element={<EmployerLandingPage />} />
        <Route path="/ctv" element={<CTVLandingPage />} />
        <Route path="/ctv/register" element={<CTVRegistrationPage />} />
        <Route path="/tai-khoan" element={<AccountPage />} />
        <Route path="/ho-so-ung-vien" element={<CandidateProfilePage />} />
        <Route path="/ho-so-ctv" element={<CTVProfilePage />} />
        <Route path="/ho-so-cong-ty" element={<CompanyProfilePage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        <Route path="/ctv/dashboard" element={<CTVRoute><CTVDashboardPage /></CTVRoute>} />
        <Route path="/ctv/campaigns" element={<CTVRoute><CTVCampaignsPage /></CTVRoute>} />
        <Route path="/ctv/leads" element={<CTVRoute><CTVDashboardPage /></CTVRoute>} />
        <Route path="/ctv/commissions" element={<CTVRoute><CTVDashboardPage /></CTVRoute>} />

        <Route path="/company/dashboard" element={<CompanyRoute><CompanyDashboardPage /></CompanyRoute>} />
        <Route path="/company/campaigns" element={<CompanyRoute><CompanyDashboardPage /></CompanyRoute>} />
        <Route path="/company/leads" element={<CompanyRoute><CompanyDashboardPage /></CompanyRoute>} />
        <Route path="/company/payments" element={<CompanyRoute><CompanyDashboardPage /></CompanyRoute>} />

        <Route path="/admin/console" element={<AdminConsolePage />} />
        <Route path="/admin/campaigns" element={<AdminConsolePage />} />
        <Route path="/admin/leads" element={<AdminConsolePage />} />
        <Route path="/admin/reports" element={<AdminConsolePage />} />
      </Routes>
      <Footer />
      <InstallAppBanner />
      {!hideChatbot && <Chatbot />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
