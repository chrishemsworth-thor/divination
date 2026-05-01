const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebookexternalhit/i,
  /ia_archiver/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /screaming.frog/i,
  /petalbot/i,
  /dataforseobot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /anthropic-ai/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /curl\//i,
  /wget\//i,
  /libwww-perl/i,
  /node-fetch/i,
];

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.length === 0) return true;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function parseDevice(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function parseBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return 'Opera';
  if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/msie|trident/i.test(userAgent)) return 'IE';
  return 'Other';
}

export function parseReferrer(referrer: string): string {
  if (!referrer) return '';
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
