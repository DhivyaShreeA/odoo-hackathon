import nodemailer from "nodemailer";

let cachedTransporter = null;
let usingEthereal = false;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Real SMTP configured (Gmail, SendGrid, your college mail server, etc.)
    // — the OTP is genuinely delivered to the user's inbox.
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    usingEthereal = false;
    return cachedTransporter;
  }

  // No SMTP configured — auto-create a free Ethereal test mailbox so the OTP
  // still travels over real SMTP (not just echoed back in the API response).
  // A preview link is returned so you can open the actual received email.
  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  usingEthereal = true;
  return cachedTransporter;
}

export async function sendOtpEmail(toEmail, otp) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"StockSense" <no-reply@stocksense.local>',
    to: toEmail,
    subject: "Your StockSense password reset code",
    text: `Your one-time code is ${otp}. It expires in 5 minutes.`,
    html: `<div style="font-family:sans-serif;font-size:15px;color:#1B2430">
             <p>Your one-time code is:</p>
             <p style="font-size:28px;font-weight:600;letter-spacing:4px">${otp}</p>
             <p style="color:#6B7280">This code expires in 5 minutes.</p>
           </div>`,
  });

  return {
    usingEthereal,
    previewUrl: usingEthereal ? nodemailer.getTestMessageUrl(info) : null,
  };
}
