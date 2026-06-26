import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/auth';
import { AnalyticsController } from './analytics.controller';

const router = Router();
const controller = new AnalyticsController();

router.get('/daily', authenticate, authorizeRoles('Owner', 'Staff'), controller.getDailySummary.bind(controller));
router.get('/top-plates', authenticate, authorizeRoles('Owner', 'Staff'), controller.getTopPlates.bind(controller));
router.get('/platform-comparison', authenticate, authorizeRoles('Owner', 'Staff'), controller.getPlatformComparison.bind(controller));
router.get('/sales-trend', authenticate, authorizeRoles('Owner', 'Staff'), controller.getSalesTrend.bind(controller));

export default router;
