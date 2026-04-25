import { cmsSupabase } from '@/services/cmsService';

type AdminCommand =
  | {
      type: 'set-breaking-news';
      message: string;
      target: string;
      durationMinutes: number;
    }
  | {
      type: 'clear-breaking-news';
      target: string;
    }
  | {
      type: 'add-tv-announcement';
      title: string;
      content: string;
      target: string;
      priority: 'low' | 'medium' | 'high';
    }
  | {
      type: 'add-tv-ticker';
      label: string;
      text: string;
      target: string;
    };

const DEFAULT_BREAKING_DURATION_MINUTES = 30;

export function detectAdminCommand(message: string): AdminCommand | null {
  const text = message.trim();
  const lower = text.toLowerCase();
  const target = parseTvTarget(text);

  if (!/\b(breaking\s+news|urgent\s+news|emergency\s+news)\b/.test(lower)) {
    if (isTickerCommand(lower)) {
      const tickerText = parseDisplayMessage(text);
      if (!tickerText) return null;
      return {
        type: 'add-tv-ticker',
        label: parseTickerLabel(text),
        text: tickerText,
        target,
      };
    }

    if (isAnnouncementCommand(lower)) {
      const content = parseDisplayMessage(text);
      if (!content) return null;
      return {
        type: 'add-tv-announcement',
        title: parseAnnouncementTitle(text, content),
        content,
        target,
        priority: parsePriority(text),
      };
    }

    return null;
  }

  if (/\b(clear|remove|delete|stop|deactivate|turn\s+off)\b/.test(lower)) {
    return { type: 'clear-breaking-news', target };
  }

  const extractedMessage = parseBreakingMessage(text);
  if (!extractedMessage) return null;

  return {
    type: 'set-breaking-news',
    message: extractedMessage,
    target,
    durationMinutes: parseDurationMinutes(text) ?? DEFAULT_BREAKING_DURATION_MINUTES,
  };
}

export async function executeAdminCommand(command: AdminCommand, actorName = 'Assistant User'): Promise<string> {
  switch (command.type) {
    case 'set-breaking-news':
      return setBreakingNews(command);
    case 'clear-breaking-news':
      return clearBreakingNews(command.target);
    case 'add-tv-announcement':
      return addTvAnnouncement(command, actorName);
    case 'add-tv-ticker':
      return addTvTicker(command);
  }
}

function isTickerCommand(text: string): boolean {
  return /\b(add|create|post|publish|show|set)\b/.test(text) &&
    /\b(ticker|scroll|headline\s+bar|bottom\s+bar)\b/.test(text) &&
    /\b(tv|display|screen|all\s+tvs?|tv\s*-?\s*\d+)\b/.test(text);
}

function isAnnouncementCommand(text: string): boolean {
  return /\b(add|create|post|publish|show|set)\b/.test(text) &&
    /\b(announcement|notice|message|headline)\b/.test(text) &&
    /\b(tv|display|screen|all\s+tvs?|tv\s*-?\s*\d+)\b/.test(text);
}

function parseTvTarget(text: string): string {
  if (/\b(all\s+tv|all\s+tvs|all\s+display|all\s+displays)\b/i.test(text)) return 'all';
  const tv = text.match(/\bTV\s*-?\s*(\d+)\b/i)?.[1];
  return tv ? `TV${tv}` : 'all';
}

function parseDurationMinutes(text: string): number | null {
  const match = text.match(/\b(?:for|duration|set\s+it\s+for)?\s*(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return unit.startsWith('h') ? amount * 60 : amount;
}

function parseBreakingMessage(text: string): string | null {
  const quoted = text.match(/["“']([^"”']+)["”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const messageMatch = text.match(/\bmessage\s+(?:is\s+|as\s+|:)?(.+?)(?:\.\s*)?(?:set\s+it\s+for|for\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)|duration|target|$)/i)?.[1]?.trim();
  if (messageMatch) return cleanMessage(messageMatch);

  const usingMatch = text.match(/\busing\s+(?:a\s+)?message\s+(.+?)(?:\.\s*)?(?:set\s+it\s+for|for\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)|duration|target|$)/i)?.[1]?.trim();
  if (usingMatch) return cleanMessage(usingMatch);

  const afterBreaking = text.match(/\b(?:add|set|create|post|publish)\s+(?:a\s+)?breaking\s+news\s+(?:for\s+.+?\s+)?(?:that\s+|as\s+|:)?(.+?)(?:\.\s*)?(?:set\s+it\s+for|for\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)|duration|target|$)/i)?.[1]?.trim();
  if (afterBreaking) return cleanMessage(afterBreaking);

  return null;
}

function parseDisplayMessage(text: string): string | null {
  const quoted = text.match(/["“']([^"”']+)["”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const explicit = text.match(/\b(?:message|text|content)\s+(?:is\s+|as\s+|:)?(.+?)(?:\.\s*)?(?:for\s+(?:all\s+tv|all\s+tvs|tv\s*-?\s*\d+)|target|priority|$)/i)?.[1]?.trim();
  if (explicit) return cleanMessage(explicit);

  const afterCommand = text.match(/\b(?:add|create|post|publish|show|set)\s+(?:a\s+|an\s+)?(?:tv\s+|display\s+)?(?:announcement|notice|message|headline|ticker|ticker\s+item)\s+(?:for\s+.+?\s+)?(?:that\s+|as\s+|:)?(.+?)(?:\.\s*)?(?:for\s+(?:all\s+tv|all\s+tvs|tv\s*-?\s*\d+)|target|priority|$)/i)?.[1]?.trim();
  if (afterCommand) return cleanMessage(afterCommand);

  return null;
}

function parseAnnouncementTitle(text: string, content: string): string {
  const title = text.match(/\btitle\s+(?:is\s+|as\s+|:)?(.+?)(?:\.|,|;|$)/i)?.[1]?.trim();
  if (title) return title.slice(0, 120);
  return content.length > 70 ? `${content.slice(0, 67)}...` : content;
}

function parseTickerLabel(text: string): string {
  const label = text.match(/\blabel\s+(?:is\s+|as\s+|:)?([A-Za-z0-9 _-]+?)(?:\.|,|;|$)/i)?.[1]?.trim();
  if (label) return label.toUpperCase().slice(0, 24);
  if (/\burgent|emergency|important/i.test(text)) return 'URGENT';
  return 'SPECIAL UPDATE';
}

function parsePriority(text: string): 'low' | 'medium' | 'high' {
  if (/\b(high|urgent|emergency|important)\b/i.test(text)) return 'high';
  if (/\b(low|normal)\b/i.test(text)) return 'low';
  return 'medium';
}

function cleanMessage(value: string): string {
  return value
    .replace(/\bfor\s+(?:all\s+tv|all\s+tvs|tv\s*-?\s*\d+)\b/gi, '')
    .replace(/\busing\s+(?:a\s+)?message\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

async function setBreakingNews(command: Extract<AdminCommand, { type: 'set-breaking-news' }>): Promise<string> {
  const expiresAt = new Date(Date.now() + command.durationMinutes * 60 * 1000).toISOString();
  const suffix = `_${command.target}`;

  const { error } = await cmsSupabase
    .from('cms_tv_settings')
    .upsert([
      { key: `breaking_news_text${suffix}`, value: command.message },
      { key: `breaking_news_expires_at${suffix}`, value: expiresAt },
    ], { onConflict: 'key' });

  if (error) throw error;

  return [
    'Breaking News Updated',
    `Action: Activated breaking news`,
    `Target: ${command.target === 'all' ? 'All TV displays' : command.target}`,
    `Message: ${command.message}`,
    `Duration: ${command.durationMinutes} minutes`,
    `Expires At: ${expiresAt}`,
  ].join('\n');
}

async function clearBreakingNews(target: string): Promise<string> {
  const suffix = `_${target}`;
  const { error } = await cmsSupabase
    .from('cms_tv_settings')
    .upsert([
      { key: `breaking_news_text${suffix}`, value: '' },
      { key: `breaking_news_expires_at${suffix}`, value: '' },
    ], { onConflict: 'key' });

  if (error) throw error;

  return [
    'Breaking News Cleared',
    `Target: ${target === 'all' ? 'All TV displays' : target}`,
    'Status: Breaking news is now inactive for this target.',
  ].join('\n');
}

async function addTvAnnouncement(
  command: Extract<AdminCommand, { type: 'add-tv-announcement' }>,
  actorName: string,
): Promise<string> {
  const { error } = await cmsSupabase
    .from('cms_tv_announcements')
    .insert({
      title: command.title,
      content: command.content,
      type: 'notice',
      course_code: null,
      priority: command.priority,
      scheduled_date: null,
      target: command.target,
      is_active: true,
      created_by: actorName,
    });

  if (error) throw error;

  return [
    'TV Announcement Added',
    `Target: ${command.target === 'all' ? 'All TV displays' : command.target}`,
    `Priority: ${command.priority}`,
    `Title: ${command.title}`,
    `Message: ${command.content}`,
    'Status: Active',
  ].join('\n');
}

async function addTvTicker(command: Extract<AdminCommand, { type: 'add-tv-ticker' }>): Promise<string> {
  const { data: lastTicker } = await cmsSupabase
    .from('cms_tv_ticker')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = Number(lastTicker?.sort_order ?? 0) + 1;

  const { error } = await cmsSupabase
    .from('cms_tv_ticker')
    .insert({
      label: command.label,
      text: command.text,
      type: 'notice',
      course_code: null,
      announcement_id: null,
      target: command.target,
      is_active: true,
      sort_order: sortOrder,
    });

  if (error) throw error;

  return [
    'TV Ticker Added',
    `Target: ${command.target === 'all' ? 'All TV displays' : command.target}`,
    `Label: ${command.label}`,
    `Text: ${command.text}`,
    `Status: Active`,
  ].join('\n');
}
