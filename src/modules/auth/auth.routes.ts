import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate, authorizeRoles } from '../../middleware/auth';

const router = Router();
const controller = new AuthController();

// Public auth routes
router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.post('/refresh', controller.refresh.bind(controller));
router.post('/logout', controller.logout.bind(controller));

// Superadmin admin controls
router.get(
  '/admin/tenants',
  authenticate,
  authorizeRoles('Superadmin'),
  controller.listTenants.bind(controller)
);
router.put(
  '/admin/tenants/:id/status',
  authenticate,
  authorizeRoles('Superadmin'),
  controller.toggleTenantStatus.bind(controller)
);
router.post(
  '/admin/tenants',
  authenticate,
  authorizeRoles('Superadmin'),
  controller.createTenant.bind(controller)
);

export default router;
