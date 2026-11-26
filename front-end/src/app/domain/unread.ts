/** FR-16: pill text, or null when there is nothing unread (the pill is hidden at 0). */
export function unreadLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}
