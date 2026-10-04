export async function embedTexts(texts: string[], _apiKey: string): Promise<number[][]> {
  // Placeholder: return zero vectors of dimension 1536
  // Replace with actual embedding call when embedding model is configured.
  return texts.map(() => new Array(1536).fill(0));
}
