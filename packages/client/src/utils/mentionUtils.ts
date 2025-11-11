/**
 * Parse message content to highlight @mentions
 * Returns array of segments with text and whether they're mentions
 */
export function parseMentionsInMessage(
  content: string
): Array<{ text: string; isMention: boolean }> {
  const mentionRegex = /(@[a-zA-Z0-9_-]+)/g
  const parts: Array<{ text: string; isMention: boolean }> = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        text: content.substring(lastIndex, match.index),
        isMention: false,
      })
    }

    // Add mention
    parts.push({
      text: match[0],
      isMention: true,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      text: content.substring(lastIndex),
      isMention: false,
    })
  }

  return parts.length > 0 ? parts : [{ text: content, isMention: false }]
}

/**
 * Extract username from @mention
 */
export function extractUsername(mention: string): string {
  return mention.replace('@', '')
}
