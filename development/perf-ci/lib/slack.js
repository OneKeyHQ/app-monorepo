async function postSlackWebhook(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Slack webhook failed: ${res.status} ${res.statusText} ${text}`,
    );
  }
}

module.exports = {
  postSlackWebhook,
};
