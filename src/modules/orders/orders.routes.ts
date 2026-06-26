import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/auth';
import { OrdersController } from './orders.controller';

const router = Router();
const controller = new OrdersController();

router.post('/manual', authenticate, authorizeRoles('Owner', 'Staff'), controller.createManualOrder.bind(controller));

export default router;
