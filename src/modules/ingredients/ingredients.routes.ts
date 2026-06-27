import { Router } from 'express';
import { IngredientsController } from './ingredients.controller';
import { authenticate, authorizeRoles } from '../../middleware/auth';

const router = Router();
const controller = new IngredientsController();

router.get('/', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.getIngredients.bind(controller));
router.get('/upload-signature', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.getUploadSignature.bind(controller));
router.post('/', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.createIngredient.bind(controller));
router.put('/:id', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.updateIngredient.bind(controller));
router.patch('/:id/stock', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.adjustStock.bind(controller));
router.delete('/:id', authenticate, authorizeRoles('Owner', 'Staff', 'Superadmin'), controller.deleteIngredient.bind(controller));

export default router;
