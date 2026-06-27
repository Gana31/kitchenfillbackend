import { Request, Response } from 'express';
import { PasswordService } from './password.service';
import { AuthenticatedRequest } from '../../middleware/auth';

const passwordService = new PasswordService();

export class PasswordController {
  public async sendForgotOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
      }

      await passwordService.sendForgotPasswordOtp(email);
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email.',
      });
    } catch (error: any) {
      console.error('Send forgot OTP error:', error);
      const isNotRegistered = error.message?.includes('not registered');
      return res.status(isNotRegistered ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to send verification code.',
      });
    }
  }

  public async resetForgotPassword(req: Request, res: Response) {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Email, OTP, and new password are required.',
        });
      }

      await passwordService.resetPasswordWithOtp(email, otp, newPassword);
      return res.status(200).json({
        success: true,
        message: 'Password updated successfully. You can now sign in.',
      });
    } catch (error: any) {
      console.error('Reset forgot password error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to reset password.',
      });
    }
  }

  public async sendChangeOtp(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const result = await passwordService.sendChangePasswordOtp(req.user.id);
      return res.status(200).json({
        success: true,
        message: `Verification code sent to ${result.email}.`,
        email: result.email,
      });
    } catch (error: any) {
      console.error('Send change OTP error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to send verification code.',
      });
    }
  }

  public async confirmChangePassword(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { otp, newPassword } = req.body;
      if (!otp || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'OTP and new password are required.',
        });
      }

      await passwordService.changePasswordWithOtp(req.user.id, otp, newPassword);
      return res.status(200).json({
        success: true,
        message: 'Password updated successfully.',
      });
    } catch (error: any) {
      console.error('Confirm change password error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to update password.',
      });
    }
  }
}
