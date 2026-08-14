const PRODUCT_DOC_PATTERN = /<product_doc>([\s\S]*?)<\/product_doc>/i;
const POLICY_DETAILS_PATTERN = /<policy_details>([\s\S]*?)<\/policy_details>/i;
const INDEX_SECTION_PATTERN = /(?:product documentation|product overview|introduction)\s+/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatCustomerLevel(level: string | null | undefined) {
  if (!level) return '';
  return level.charAt(0).toLocaleUpperCase('en-US') + level.slice(1);
}

export function toReadableSourcePreview(content: string | null | undefined, maxLength = 160, title?: string | null) {
  if (!content) return '';

  const taggedBody = content.match(PRODUCT_DOC_PATTERN)?.[1] ?? content.match(POLICY_DETAILS_PATTERN)?.[1];
  let text = (taggedBody ?? content)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const sectionParts = text.split(INDEX_SECTION_PATTERN);
  if (sectionParts.length > 1) {
    text = sectionParts
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
  }

  if (title?.trim()) {
    text = text.replace(new RegExp(`^${escapeRegExp(title.trim())}(?:\\s+|$)`, 'i'), '').trim();
  }

  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
