import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import './lib/aiInlineResultModalBridge';
import './lib/companyLeadWorkflowBridge';
import './lib/adminLeadWorkflowBridge';
import './lib/adminLeadHistoryBridge';
import { RoleProvider } from './contexts/RoleContext';
import { registerPwaServiceWorker } from './lib/pwaRegistration';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

registerPwaServiceWorker();

if (!publishableKey) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Thiếu cấu hình Clerk</h1>
        <p>Vui lòng thêm VITE_CLERK_PUBLISHABLE_KEY vào .env.local rồi restart npm run dev.</p>
      </div>
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <RoleProvider>
          <App />
        </RoleProvider>
      </ClerkProvider>
    </React.StrictMode>
  );
}
