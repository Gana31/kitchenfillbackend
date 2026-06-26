import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/auth';
import { RecipesController } from './recipes.controller';

const router = Router();
const controller = new RecipesController();

router.get('/', authenticate, authorizeRoles('Owner', 'Staff'), controller.getRecipes.bind(controller));
router.get('/counter-menu', authenticate, authorizeRoles('Owner', 'Staff'), controller.getCounterMenu.bind(controller));
router.post('/preview-cost', authenticate, authorizeRoles('Owner', 'Staff'), controller.previewRecipeCost.bind(controller));
router.post('/', authenticate, authorizeRoles('Owner', 'Staff'), controller.createRecipe.bind(controller));
router.put('/:id', authenticate, authorizeRoles('Owner', 'Staff'), controller.updateRecipe.bind(controller));
router.delete('/:id', authenticate, authorizeRoles('Owner', 'Staff'), controller.deleteRecipe.bind(controller));

export default router;
