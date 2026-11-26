/** FR-16: pill text for the unread counter; empty at 0 (the pill is hidden). */
export function unreadLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}
