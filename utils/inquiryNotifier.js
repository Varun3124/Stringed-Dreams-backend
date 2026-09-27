const User = require('../models/User');
const Product = require('../models/Product');
const Playlist = require('../models/Playlist');
const { sendMail, isEmailConfigured } = require('./mailer');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const siteUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Everyone with the admin role, plus any extra addresses in ADMIN_EMAILS (comma-separated)
const getAdminEmails = async () => {
  const extra = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
  const admins = await User.find({ role: 'admin' }).select('email').lean();
  const all = [...extra, ...admins.map((a) => a.email)].filter(Boolean);
  return [...new Map(all.map((email) => [email.toLowerCase(), email])).values()];
};

/*
 * Email the admins about a customer's message. Resolves to true when the email was sent,
 * false when email isn't configured or there is nobody to send to.
 */
const notifyAdminsOfInquiry = async ({ customer, text, productId, playlistId, isNewConversation }) => {
  // sendMail logs a one-time 'not configured' warning and resolves to false
  if (!isEmailConfigured()) return sendMail({ to: [] });

  const to = await getAdminEmails();
  if (to.length === 0) {
    console.warn('Inquiry email skipped: no admin email addresses found');
    return false;
  }

  const [product, playlist] = await Promise.all([
    productId ? Product.findById(productId).select('name price').lean() : null,
    playlistId ? Playlist.findById(playlistId).select('name items').lean() : null
  ]);

  const base = siteUrl();
  const name = customer?.name || 'A customer';
  const reference = product
    ? { label: 'Product', name: product.name || 'Untitled product', detail: `₹${Number(product.price || 0).toLocaleString('en-IN')}`, url: `${base}/product/${product._id}` }
    : playlist
      ? { label: 'Collection', name: playlist.name, detail: `${playlist.items?.length || 0} items`, url: `${base}/playlists/${playlist._id}` }
      : null;
  const dashboardUrl = `${base}/admin`;

  const subject = `${isNewConversation ? 'New inquiry' : 'New message'} from ${name}${reference ? ` about ${reference.name}` : ''}`;

  const plainText = [
    `${name} sent a message on Stringed Dreams:`,
    '',
    text,
    '',
    reference ? `${reference.label}: ${reference.name} (${reference.detail}) — ${reference.url}` : null,
    `From: ${name} <${customer?.email || 'no email'}>${customer?.phone ? `, phone ${customer.phone}` : ''}`,
    '',
    `Reply in the admin dashboard: ${dashboardUrl}`
  ].filter((line) => line !== null).join('\n');

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2d3748">
  <h2 style="margin:0 0 4px;color:#7b2cbf;font-size:20px">${escapeHtml(subject)}</h2>
  <p style="margin:0 0 16px;color:#718096;font-size:14px">
    ${escapeHtml(name)} &lt;${escapeHtml(customer?.email || 'no email')}&gt;${customer?.phone ? ` · ${escapeHtml(customer.phone)}` : ''}
  </p>
  <div style="background:#f7f2fb;border-left:4px solid #9d4edd;border-radius:8px;padding:14px 16px;white-space:pre-line;font-size:15px;line-height:1.5">${escapeHtml(text)}</div>
  ${reference ? `
  <p style="margin:16px 0 0;font-size:14px">
    <strong>${escapeHtml(reference.label)}:</strong>
    <a href="${escapeHtml(reference.url)}" style="color:#7b2cbf">${escapeHtml(reference.name)}</a>
    <span style="color:#718096">(${escapeHtml(reference.detail)})</span>
  </p>` : ''}
  <p style="margin:24px 0 0">
    <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#9d4edd;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Reply in the dashboard</a>
  </p>
  <p style="margin:16px 0 0;color:#a0aec0;font-size:12px">You can also reply to this email to write to ${escapeHtml(name)} directly.</p>
</div>`;

  return sendMail({ to, subject, text: plainText, html, replyTo: customer?.email });
};

module.exports = { notifyAdminsOfInquiry, getAdminEmails };
