import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import './lib/aiInlineResultModalBridge';
import './lib/companyLeadWorkflowBridge';
import './lib/adminLeadWorkflowBridge';
import './lib/adminLeadHistoryBridge';
import { syncAdminPwaMetadata } from './lib/adminPwa';
import { registerAdminPwaServiceWorker } from './lib/adminPwaRegistration';
import { RoleProvider } from './contexts/RoleContext';

syncAdminPwaMetadata(window.location.pathname);

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = ReactDOM.createRoot(document.getElementById('root')!);

if (!publishableKey) {
  root.render(
    <React.StrictMode>
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Thiếu cấu hình Clerk</h1>
        <p>Vui lòng thêm VITE_CLERK_PUBLISHABLE_KEY vào .env.local hoặc .env.production rồi build lại.</p>
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

  registerAdminPwaServiceWorker();
}
