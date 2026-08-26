import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { EMAIL_APP_NAME } from '../celluloplast-brand';

export const welcomeEmail = defineEmail({
  id: 'welcome',
  subject: `Welcome to ${EMAIL_APP_NAME}!`,
  schema: z.object({
    name: z.string().min(1)
  }),
  render: (fields) => {
    const content = `
    <p>Dear ${fields.name},</p>
    <p>Welcome to ${EMAIL_APP_NAME}. We are glad you joined the platform.</p>
  `;

    return getDefaultTemplate(content);
  }
});
