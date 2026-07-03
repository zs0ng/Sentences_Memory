export function parseSentencesFromText(input: string): string[] {
  const seen = new Set<string>()

  return input
    .trim()
    .split(/\n\s*\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const key = sentence.toLowerCase()
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
}
