const STOPWORDS = new Set(["will", "the", "a", "an", "of", "in", "on", "to", "is", "be", "by", "at", "and"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 0 && !STOPWORDS.has(token)),
  );
}

/** Jaccard token overlap on [0, 100] — used as the lexical stand-in for semantic similarity until an LLM reranker is added. */
export function tokenOverlapScore(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}
