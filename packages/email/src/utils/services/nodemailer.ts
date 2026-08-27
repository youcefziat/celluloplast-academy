import { EmailResponse } from '../types';
import type { TEmailData } from '@cio/utils/validation/mail';
import type { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { EMAIL_FROM } from '../constants';
import nodemailer from 'nodemailer';

let transporter: Transporter | undefined;

const setupTransporter = async () => {
  // Host is required. User/password are optional so local relays (e.g. MailHog)
  // work without inventing new env vars; production SMTP providers still pass auth.
  if (!env.SMTP_HOST) {
    console.error('SMTP configuration missing: SMTP_HOST is required');
    return undefined;
  }

  try {
    const smtpPort = parseInt(env.SMTP_PORT || '465', 10);
    const useImplicitTls = smtpPort === 465;
    const hasAuth = Boolean(env.SMTP_USER && env.SMTP_PASSWORD);

    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: smtpPort,
      secure: useImplicitTls,
      // STARTTLS for authenticated submission ports (e.g. 587). Skip for plain
      // local SMTP relays that do not speak TLS (MailHog on 1025).
      requireTLS: !useImplicitTls && hasAuth,
      ...(hasAuth
        ? {
            auth: {
              user: env.SMTP_USER!,
              pass: env.SMTP_PASSWORD!
            }
          }
        : {})
    });

    await transporter.verify();

    return transporter;
  } catch (error) {
    console.error('Transporter error:', error);
    return undefined;
  }
};

export async function sendWithNodemailer(emailData: TEmailData): Promise<EmailResponse> {
  const { from, to, subject, content, replyTo, ics } = emailData;

  if (!transporter) {
    transporter = await setupTransporter();
  }

  if (!transporter) {
    return {
      success: false,
      error: 'Email transporter not initialized'
    };
  }

  try {
    const result = await transporter.sendMail({
      from: from ?? EMAIL_FROM,
      to,
      subject,
      replyTo,
      html: content,
      ...(ics ? { icalEvent: { filename: 'session.ics', method: 'PUBLISH', content: ics } } : {})
    });

    return {
      success: true,
      details: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error
    };
  }
}
