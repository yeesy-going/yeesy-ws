import { test } from "node:test";
import assert from "node:assert/strict";
import { ratioPercent, sortByRatioDesc, searcherUrl } from "./ratio.ts";

test("ratio: 8,000 / 10,000 = 80%, 15,000 / 10,000 = 150%", () => {
  assert.equal(ratioPercent(8000, 10000), 80);
  assert.equal(ratioPercent(15000, 10000), 150);
});

test("ratio: 가격이 없으면 null", () => {
  assert.equal(ratioPercent(null, 10000), null);
  assert.equal(ratioPercent(8000, null), null);
  assert.equal(ratioPercent(8000, 0), null);
});

test("sort: 비율 내림차순, 비율 없는 행은 뒤로", () => {
  const rows = [
    { n: "a", priceKrw: 8000, searcherPriceKrw: 10000 },
    { n: "b", priceKrw: null, searcherPriceKrw: 10000 },
    { n: "c", priceKrw: 15000, searcherPriceKrw: 10000 },
    { n: "d", priceKrw: 9000, searcherPriceKrw: null },
  ];
  assert.deepEqual(sortByRatioDesc(rows).map((r) => r.n), ["c", "a", "b", "d"]);
});

test("searcherUrl: 스크린샷의 주소 형식과 일치", () => {
  assert.equal(
    searcherUrl("Louis Roederer Brut Rosé Millesime, Champagne, France"),
    "https://www.wine-searcher.com/find/louis+roederer+brut+rose+millesime+champagne+france",
  );
});
