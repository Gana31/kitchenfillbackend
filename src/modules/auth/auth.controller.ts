import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../middleware/auth';

const authService = new AuthService();

export class AuthController {
  /**
   * HTTP Handler to register a new Owner and their Tenant.
   */
  public async register(req: Request, res: Response) {
    try {
      const { name, email, password, businessName } = req.body;

      if (!name || !email || !password || !businessName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: name, email, password, businessName.',
        });
      }

      const data = await authService.registerOwner(name, email, password, businessName);

      return res.status(201).json({
        success: true,
        message: 'Owner and tenant workspace successfully registered.',
        ...data,
      });
    } catch (error: any) {
      console.error('Register Handler Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'An error occurred during registration.',
      });
    }
  }

  /**
   * HTTP Handler to authenticate users.
   */
  public async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: email, password.',
        });
      }

      const data = await authService.login(email, password);

      return res.status(200).json({
        success: true,
        message: 'Successfully authenticated.',
        ...data,
      });
    } catch (error: any) {
      console.error('Login Handler Error:', error);
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid credentials.',
      });
    }
  }

  /**
   * HTTP Handler to refresh short-lived Access Tokens.
   */
  public async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: refreshToken.',
        });
      }

      const tokens = await authService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Token successfully refreshed.',
        ...tokens,
      });
    } catch (error: any) {
      console.error('Refresh Token Handler Error:', error);
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid session refresh request.',
      });
    }
  }

  /**
   * HTTP Handler to invalidate a Refresh Token and end session.
   */
  public async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: refreshToken.',
        });
      }

      await authService.logout(refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error: any) {
      console.error('Logout Handler Error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred during logout.',
      });
    }
  }

  /**
   * HTTP Handler for Superadmin to list all registered owners and tenants.
   */
  public async listTenants(req: AuthenticatedRequest, res: Response) {
    try {
      const tenants = await authService.listTenants();
      return res.status(200).json({
        success: true,
        tenants,
      });
    } catch (error: any) {
      console.error('List Tenants Handler Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list tenants.',
      });
    }
  }  /**
   * HTTP Handler for Superadmin to create a new Owner and Tenant workspace.
   */
  public async createTenant(req: Request, res: Response) {
    try {
      const { name, email, password, businessName } = req.body;

      if (!name || !email || !password || !businessName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: name, email, password, businessName.',
        });
      }

      const data = await authService.registerOwner(name, email, password, businessName);

      return res.status(201).json({
        success: true,
        message: 'Tenant workspace and owner successfully created.',
        user: data.user,
      });
    } catch (error: any) {
      console.error('Create Tenant Handler Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to create tenant workspace.',
      });
    }
  }

  /**
   * HTTP Handler for Superadmin to activate/deactivate tenant accounts.
   */
  public async toggleTenantStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'deactivated'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid status parameter. Must be active or deactivated.',
        });
      }

      const tenant = await authService.toggleTenantStatus(id, status);

      return res.status(200).json({
        success: true,
        message: `Tenant status successfully updated to '${status}'.`,
        tenant,
      });
    } catch (error: any) {
      console.error('Toggle Tenant Status Handler Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to change tenant status.',
      });
    }
  }
}
