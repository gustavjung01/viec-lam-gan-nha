import React from 'react';
import ReactDOM from 'react-dom/client';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </React.StrictMode>
);

registerAdminPwaServiceWorker();
