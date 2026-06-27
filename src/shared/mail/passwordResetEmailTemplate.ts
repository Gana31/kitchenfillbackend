export function buildPasswordOtpEmailHtml(params: {
  recipientName: string;
  otp: string;
  purposeLabel: string;
  expiresMinutes: number;
}): string {
  const { recipientName, otp, purposeLabel, expiresMinutes } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KitchenFill verification code</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 12px 40px rgba(24,24,27,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#ff6b00 0%,#ff8a3d 100%);padding:28px 32px;">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                Kitchen<span style="opacity:0.95;">Fill</span><span style="color:#fff;">.</span>
              </div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.92);font-weight:500;">
                Smart Cloud Kitchen Inventory
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">Hello ${recipientName},</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#18181b;">
                Your verification code
              </h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#52525b;">
                Use this code to ${purposeLabel}. For your security, do not share it with anyone.
              </p>
              <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#ff6b00;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
                  One-time password
                </div>
                <div style="font-size:36px;font-weight:800;letter-spacing:0.35em;color:#18181b;padding-left:0.35em;">
                  ${otp}
                </div>
              </div>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">
                This code expires in <strong style="color:#18181b;">${expiresMinutes} minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f4f4f5;background:#fafafa;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#a1a1aa;text-align:center;">
                © ${new Date().getFullYear()} KitchenFill · Secure kitchen management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordOtpEmailText(params: {
  recipientName: string;
  otp: string;
  purposeLabel: string;
  expiresMinutes: number;
}): string {
  const { recipientName, otp, purposeLabel, expiresMinutes } = params;
  return `Hello ${recipientName},

Your KitchenFill verification code is: ${otp}

Use this code to ${purposeLabel}. It expires in ${expiresMinutes} minutes.

If you did not request this, you can ignore this email.

— KitchenFill`;
}
