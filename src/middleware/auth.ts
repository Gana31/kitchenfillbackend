import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/models/User';
import { Tenant } from '../modules/auth/models/Tenant';

// Interface for JWT Payload
export interface TokenPayload {
  id: string;
  email: string;
  role: 'Superadmin' | 'Owner' | 'Staff';
  tenantId: string | null; // Null for Superadmin
}

// Custom request interface extending standard Express Request
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_jwt_secret_key_123456';

/**
 * Authentication and Multi-Tenant Isolation Middleware.
 * Extracts the user token, verifies it, checks if the account is active, and attaches details to Request.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No authorization token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Fetch user from database to ensure they are active
    const userDoc = await User.findById(decoded.id);
    if (!userDoc || userDoc.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Your account is deactivated or deleted.',
      });
    }

    // If tenantId is present, ensure Tenant is active
    if (userDoc.tenantId) {
      const tenantDoc = await Tenant.findById(userDoc.tenantId);
      if (!tenantDoc || tenantDoc.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. The business tenant workspace is deactivated.',
        });
      }
    }

    // Attach decoded user information to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId ? decoded.tenantId.toString() : null,
    };

    // Superadmin can operate inside any tenant workspace via x-tenant-id header
    if (req.user.role === 'Superadmin') {
      const overrideTenantId = req.headers['x-tenant-id'];
      if (overrideTenantId && typeof overrideTenantId === 'string') {
        const tenantDoc = await Tenant.findById(overrideTenantId.trim());
        if (!tenantDoc) {
          return res.status(404).json({
            success: false,
            error: 'Tenant workspace not found.',
          });
        }
        req.user.tenantId = tenantDoc._id.toString();
      }
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return res.status(401).json({
      success: false,
      error: 'Access denied. Invalid or expired token.',
    });
  }
};

/**
 * Role-Based Access Control Middleware.
 * Restricts route access to specific roles.
 */
export const authorizeRoles = (...roles: Array<'Superadmin' | 'Owner' | 'Staff'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. User session not found.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};
