import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  cancelTransaction,
  confirmTransaction,
  createTransaction,
  getTransactionById,
  getWalletBalance,
  initializeFinance,
  listTransactions,
} from '../finance/ledgerService.js';
import {
  getAdminFinanceOverview,
  getLatestReconciliation,
  runFinanceReconciliation,
} from '../finance/reportService.js';

const router = Router();

function sendError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
}

router.get('/health', async (req, res) => {
  try {
    const result = await initializeFinance();
    res.json({ success: true, status: 'ok', module: 'finance', ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/migrate', adminAuth, async (req, res) => {
  try {
    const result = await initializeFinance();
    res.json({ success: true, message: 'Finance schema initialized', data: result });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/overview', adminAuth, async (req, res) => {
  try {
    const overview = await getAdminFinanceOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/reconciliation', adminAuth, async (req, res) => {
  try {
    const data = await getLatestReconciliation();
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/reconciliation-runs', adminAuth, async (req, res) => {
  try {
    const data = await runFinanceReconciliation({
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      actorUserId: req.user?.email || req.user?.id || 'admin',
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/wallet/:userId', adminAuth, async (req, res) => {
  try {
    const wallet = await getWalletBalance(req.params.userId);
    res.json({ success: true, data: wallet });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/transactions/:userId', adminAuth, async (req, res) => {
  try {
    const transactions = await listTransactions(req.params.userId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/transactions/id/:id', adminAuth, async (req, res) => {
  try {
    const tx = await getTransactionById(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: tx });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/transactions', adminAuth, async (req, res) => {
  try {
    const tx = await createTransaction(req.body);
    res.status(201).json({ success: true, data: tx });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/transactions/:id/confirm', adminAuth, async (req, res) => {
  try {
    const tx = await confirmTransaction(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: tx });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/transactions/:id/cancel', adminAuth, async (req, res) => {
  try {
    const tx = await cancelTransaction(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: tx });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
