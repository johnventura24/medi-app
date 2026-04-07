import { Resend } from "resend";

// Initialize Resend — graceful if no key set
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@medisuperapp.com";
const APP_NAME = "Prism";

const BRAND_HEADER = `
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 1px;">
      ${APP_NAME}
    </h1>
    <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">
      Medicare Superintelligence
    </p>
  </div>
`;

const BRAND_FOOTER = `
  <div style="padding: 20px 24px; text-align: center; color: #9ca3af; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${APP_NAME} &mdash; Medicare Superintelligence. All rights reserved.</p>
  </div>
`;

function wrapEmail(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr><td>${BRAND_HEADER}</td></tr>
          <tr><td style="padding: 32px 24px;">${bodyHtml}</td></tr>
          <tr><td>${BRAND_FOOTER}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!resend) {
    console.log("Email not configured, skipping welcome email");
    return;
  }

  const firstName = name?.split(" ")[0] || "there";
  const html = wrapEmail(`
    <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">Welcome to ${APP_NAME}!</h2>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      Hi ${firstName},
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      Your account is ready. You now have access to the most powerful Medicare analytics platform available &mdash;
      plan comparisons, benefit grids, carrier scorecards, and AI-powered insights, all in one place.
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Log in to get started and explore what ${APP_NAME} can do for your Medicare business.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://prismmed.io" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
        Log In to ${APP_NAME}
      </a>
    </div>
  `);

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Welcome to ${APP_NAME} — Your account is ready`,
      html,
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (err: any) {
    console.error("Failed to send welcome email:", err.message);
  }
}

export async function sendLeadNotification(
  agentEmail: string,
  agentName: string,
  lead: { firstName: string; lastName: string; zipCode: string; phone: string; state?: string | null }
): Promise<void> {
  if (!resend) {
    console.log("Email not configured, skipping lead notification");
    return;
  }

  const agentFirst = agentName?.split(" ")[0] || "Agent";
  const location = lead.state ? `${lead.zipCode} (${lead.state})` : lead.zipCode;

  const html = wrapEmail(`
    <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">New Lead Assigned</h2>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      Hi ${agentFirst},
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      A new lead has been assigned to you:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; font-weight: 600; width: 100px;">Name</td>
        <td style="padding: 10px 16px; color: #111827; font-size: 15px;">${lead.firstName} ${lead.lastName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; font-weight: 600; border-top: 1px solid #e5e7eb;">Location</td>
        <td style="padding: 10px 16px; color: #111827; font-size: 15px; border-top: 1px solid #e5e7eb;">${location}</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; font-weight: 600; border-top: 1px solid #e5e7eb;">Phone</td>
        <td style="padding: 10px 16px; color: #111827; font-size: 15px; border-top: 1px solid #e5e7eb;">${lead.phone}</td>
      </tr>
    </table>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://prismmed.io/leads" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
        View Lead in ${APP_NAME}
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">
      Please reach out within 24 hours for best results.
    </p>
  `);

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: agentEmail,
      subject: `New lead assigned: ${lead.firstName} ${lead.lastName} in ${location}`,
      html,
    });
    console.log(`Lead notification sent to ${agentEmail}`);
  } catch (err: any) {
    console.error("Failed to send lead notification:", err.message);
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!resend) {
    console.log("Email not configured, skipping password reset email");
    return;
  }

  const html = wrapEmail(`
    <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">Reset Your Password</h2>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      We received a request to reset your ${APP_NAME} password. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
        Reset Password
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">
      This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password will remain unchanged.
    </p>
  `);

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html,
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (err: any) {
    console.error("Failed to send password reset email:", err.message);
  }
}
