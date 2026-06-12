import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from './models/User';
import { Tenant, ITenant } from './models/Tenant';
import { RefreshToken } from './models/RefreshToken';
import { Types } from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_jwt_secret_key_123456';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_development_refresh_secret_key_123456';

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string | null;
    status: string;
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

export class AuthService {
  /**
   * Generates a short-lived access token.
   */
  private generateAccessToken(user: IUser): string {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Generates a long-lived refresh token.
   */
  private generateRefreshToken(user: IUser): string {
    return jwt.sign(
      {
        id: user._id,
      },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Registers a new Owner User and creates their Tenant workspace.
   */
  public async registerOwner(
    name: string,
    email: string,
    password: string,
    businessName: string
  ): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email address already registered.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create a temporary Tenant ID first
    const tenantId = new Types.ObjectId();

    // Create owner user
    const owner = new User({
      name,
      email,
      passwordHash,
      role: 'Owner',
      tenantId,
      status: 'active',
    });

    // Create tenant workspace linked to the owner
    const tenant = new Tenant({
      _id: tenantId,
      businessName,
      ownerId: owner._id,
      status: 'active',
    });

    await owner.save();
    await tenant.save();

    // Generate tokens
    const accessToken = this.generateAccessToken(owner);
    const refreshTokenString = this.generateRefreshToken(owner);

    // Save refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenDoc = new RefreshToken({
      userId: owner._id,
      token: refreshTokenString,
      expiresAt,
    });
    await refreshTokenDoc.save();

    const decodedAccess = jwt.decode(accessToken) as { exp: number };
    const decodedRefresh = jwt.decode(refreshTokenString) as { exp: number };

    return {
      user: {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        role: owner.role,
        tenantId: owner.tenantId ? owner.tenantId.toString() : null,
        status: owner.status,
      },
      accessToken,
      refreshToken: refreshTokenString,
      accessTokenExpiry: decodedAccess.exp * 1000,
      refreshTokenExpiry: decodedRefresh.exp * 1000,
    };
  }

  /**
   * Log in user, verifying password and account status.
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Verify status
    if (user.status !== 'active') {
      throw new Error('Your account has been deactivated. Please contact support.');
    }

    // If tenantId exists, ensure Tenant is active
    if (user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status !== 'active') {
        throw new Error('Your business workspace has been deactivated.');
      }
    }

    // Validate password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshTokenString = this.generateRefreshToken(user);

    // Save refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      token: refreshTokenString,
      expiresAt,
    });
    await refreshTokenDoc.save();

    const decodedAccess = jwt.decode(accessToken) as { exp: number };
    const decodedRefresh = jwt.decode(refreshTokenString) as { exp: number };

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        status: user.status,
      },
      accessToken,
      refreshToken: refreshTokenString,
      accessTokenExpiry: decodedAccess.exp * 1000,
      refreshTokenExpiry: decodedRefresh.exp * 1000,
    };
  }

  /**
   * Verifies the refresh token and rotates it, returning a new access/refresh token pair.
   */
  public async refreshAccessToken(tokenString: string): Promise<{ accessToken: string; refreshToken: string; accessTokenExpiry: number; refreshTokenExpiry: number }> {
    try {
      const decoded = jwt.verify(tokenString, REFRESH_SECRET) as { id: string };

      // Find token document in DB
      const tokenDoc = await RefreshToken.findOne({ token: tokenString });
      if (!tokenDoc || tokenDoc.isRevoked || tokenDoc.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token.');
      }

      // Check user and tenant status
      const user = await User.findById(decoded.id);
      if (!user || user.status !== 'active') {
        throw new Error('User account is deactivated.');
      }

      if (user.tenantId) {
        const tenant = await Tenant.findById(user.tenantId);
        if (!tenant || tenant.status !== 'active') {
          throw new Error('Workspace is deactivated.');
        }
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshTokenString = this.generateRefreshToken(user);

      // Perform Token Rotation: Revoke old, save new
      tokenDoc.isRevoked = true;
      tokenDoc.replacedByToken = newRefreshTokenString;
      await tokenDoc.save();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const newRefreshTokenDoc = new RefreshToken({
        userId: user._id,
        token: newRefreshTokenString,
        expiresAt,
      });
      await newRefreshTokenDoc.save();

      const decodedAccess = jwt.decode(newAccessToken) as { exp: number };
      const decodedRefresh = jwt.decode(newRefreshTokenString) as { exp: number };

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenString,
        accessTokenExpiry: decodedAccess.exp * 1000,
        refreshTokenExpiry: decodedRefresh.exp * 1000,
      };
    } catch (error) {
      console.error('Refresh Token Error:', error);
      throw new Error('Invalid session refresh request.');
    }
  }

  /**
   * Revokes the refresh token, logging the user out.
   */
  public async logout(tokenString: string): Promise<void> {
    const tokenDoc = await RefreshToken.findOne({ token: tokenString });
    if (tokenDoc) {
      tokenDoc.isRevoked = true;
      await tokenDoc.save();
    }
  }

  /**
   * Superadmin toggles the status of a Tenant workspace (and Owner/Staff).
   */
  public async toggleTenantStatus(tenantId: string, status: 'active' | 'deactivated'): Promise<ITenant> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant workspace not found.');
    }

    tenant.status = status;
    await tenant.save();

    // Toggle status of all users within this Tenant
    await User.updateMany({ tenantId }, { status });

    // Revoke all refresh tokens for users in this Tenant
    const users = await User.find({ tenantId }, '_id');
    const userIds = users.map(u => u._id);
    await RefreshToken.updateMany({ userId: { $in: userIds } }, { isRevoked: true });

    return tenant;
  }

  /**
   * Superadmin gets all tenants and owners.
   */
  public async listTenants(): Promise<any[]> {
    const tenants = await Tenant.find().populate('ownerId', 'name email status');
    return tenants;
  }

  /**
   * Seed a default Superadmin if one doesn't exist.
   */
  public async seedSuperadmin(): Promise<void> {
    const superadmin = await User.findOne({ role: 'Superadmin' });
    if (!superadmin) {
      console.log('Seeding default Superadmin account...');
      const passwordHash = await bcrypt.hash('superadmin_secure_pass_123', 10);
      const newSuper = new User({
        name: 'Superadmin Admin',
        email: 'superadmin@inventory.com',
        passwordHash,
        role: 'Superadmin',
        tenantId: null,
        status: 'active',
      });
      await newSuper.save();
      console.log('Superadmin seeded: superadmin@inventory.com / superadmin_secure_pass_123');
    }
  }
}
