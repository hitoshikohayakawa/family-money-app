// Lazy singleton — initialized once on first call, reused thereafter.
// Dictionary files (~17MB) are served from /public/dict/ and cached by the browser.
let converterPromise: Promise<(text: string) => Promise<string>> | null = null;

export function getJapaneseConverter(): Promise<(text: string) => Promise<string>> {
  if (!converterPromise) {
    converterPromise = (async () => {
      const Kuroshiro = (await import("kuroshiro")).default;
      const KuromojiAnalyzer = (await import("kuroshiro-analyzer-kuromoji")).default;
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(new KuromojiAnalyzer({ dictPath: "/dict/" }));
      return (text: string) => kuroshiro.convert(text, { to: "hiragana" });
    })().catch((err) => {
      // Reset so a retry is possible on next call
      converterPromise = null;
      throw err;
    });
  }
  return converterPromise;
}
