// The only place that sends mail: through SMTP_URL (nodemailer), or as a JSON file in MAIL_OUTBOX.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { config } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail({ to, subject, text }: Mail): Promise<void> {
  const { SMTP_URL, MAIL_OUTBOX, CONTACT_EMAIL } = config();
  if (SMTP_URL) {
    await nodemailer.createTransport(SMTP_URL).sendMail({ from: CONTACT_EMAIL, to, subject, text });
    return;
  }
  await mkdir(MAIL_OUTBOX, { recursive: true });
  await writeFile(join(MAIL_OUTBOX, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ to, subject, text }));
}
