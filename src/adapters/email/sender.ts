import { createTransport } from "nodemailer";
import { logger } from "../../util/logger.js";

export interface EmailOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    auth: {
      user: options.user,
      pass: options.pass,
    },
  });

  try {
    await transport.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.body,
    });
    logger.info({ to: options.to, subject: options.subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to: options.to }, "Failed to send email");
  } finally {
    transport.close();
  }
}
