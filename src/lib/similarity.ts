const STOP_WORDS = new Set(["will", "the", "a", "an", "to", "of", "in", "on", "by", "before", "after", "and", "or", "is", "be", "at", "for"]);

export function keywordOverlapRatio(a: string, b: string) {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}
