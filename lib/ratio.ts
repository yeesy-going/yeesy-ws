/** 내 가격 ÷ 서쳐가 × 100 (정수 %). 둘 중 하나라도 없으면 null */
export function ratioPercent(priceKrw: number | null, searcherPriceKrw: number | null): number | null {
  if (priceKrw == null || searcherPriceKrw == null || searcherPriceKrw <= 0) return null;
  return Math.round((priceKrw / searcherPriceKrw) * 100);
}

/** 비율 내림차순. 비율이 없는 행은 원래 순서를 유지한 채 맨 뒤로 */
export function sortByRatioDesc<T extends { priceKrw: number | null; searcherPriceKrw: number | null }>(
  rows: readonly T[],
): T[] {
  return rows
    .map((row, index) => ({ row, index, ratio: ratioPercent(row.priceKrw, row.searcherPriceKrw) }))
    .sort((a, b) => {
      if (a.ratio == null && b.ratio == null) return a.index - b.index;
      if (a.ratio == null) return 1;
      if (b.ratio == null) return -1;
      return b.ratio - a.ratio || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Wine-Searcher 검색 페이지 주소 (스크린샷과 같은 /find/이름+이름 형식) */
export function searcherUrl(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "+")
    .replace(/^\++|\++$/g, "");
  return `https://www.wine-searcher.com/find/${slug}`;
}
