export async function sendTrafficDropAlert(
  apiKey: string,
  opts: {
    to: string;
    domain: string;
    dropPercent: number;
    currentViews: number;
    previousViews: number;
  },
): Promise<void> {
  const subject = `EdgeIQ alert: ${opts.domain} traffic dropped ${opts.dropPercent}% this week`;
  const html = `
    <p>Hi,</p>
    <p>We noticed a significant traffic drop on <strong>${opts.domain}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666">This week</td>
        <td style="padding:4px 0"><strong>${opts.currentViews.toLocaleString()} pageviews</strong></td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666">Last week</td>
        <td style="padding:4px 0">${opts.previousViews.toLocaleString()} pageviews</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666">Change</td>
        <td style="padding:4px 0;color:#dc2626"><strong>−${opts.dropPercent}%</strong></td>
      </tr>
    </table>
    <p>Log in to EdgeIQ to investigate.</p>
    <p style="margin-top:32px;color:#999;font-size:12px">
      To stop receiving these alerts, go to Settings → Sites and disable alerts for this site.
    </p>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'EdgeIQ <alerts@edgeiq.dev>',
      to: opts.to,
      subject,
      html,
    }),
  });
}
