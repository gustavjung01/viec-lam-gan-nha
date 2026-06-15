import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import './lib/aiInlineResultModalBridge';
import './lib/companyLeadWorkflowBridge';
import './lib/adminLeadWorkflowBridge';
import './lib/adminLeadHistoryBridge';
import { registerPwaServiceWorker } from './lib/pwaRegistration';
import { registerAdminPwaServiceWorker } from './lib/adminPwaRegistration';
import { syncAdminPwaMetadata } from './lib/adminPwa';
import { RoleProvider } from './contexts/RoleContext';

syncAdminPwaMetadata();

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isAdminRoute = window.location.pathname.startsWith('/admin');
const root = ReactDOM.createRoot(document.getElementById('root')!);

if (!publishableKey && isAdminRoute) {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else if (!publishableKey) {
  root.render(
    <React.StrictMode>
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Thiếu cấu hình Clerk</h1>
        <p>Vui lòng thêm VITE_CLERK_PUBLISHABLE_KEY vào .env.local rồi restart npm run dev.</p>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <RoleProvider>
          <App />
        </RoleProvider>
      </ClerkProvider>
    </React.StrictMode>
  );
}

if (isAdminRoute) {
  registerAdminPwaServiceWorker();
} else {
  registerPwaServiceWorker();
}
