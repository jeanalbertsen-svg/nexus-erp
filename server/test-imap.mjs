import 'dotenv/config';
import { ImapFlow } from 'imapflow';

const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: Number(process.env.IMAP_PORT || 993),
  secure: (process.env.IMAP_TLS || 'true') === 'true',
  auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS?.replace(/\s+/g, '') }
});

try {
  await client.connect();

  const mbox = process.env.MAILBOX || 'INBOX';
  const lock = await client.getMailboxLock(mbox);
  try {
    const uids = await client.search({ seen: false }); // you can add more criteria here
    console.log('✅ Connected. Unseen emails =', uids.length);
    if (uids[0]) {
      const meta = await client.fetchOne(uids[0], { envelope: true });
      console.log('📧 First unseen subject =', meta.envelope.subject);
    }
  } finally {
    lock.release();
  }
} catch (e) {
  console.error('❌ IMAP error:', e.message);
} finally {
  await client.logout().catch(() => {});
}
