/** 클라이언트가 파일을 정규화해 서버로 보내는 입력 조각 */
export type InputPart =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }
  | { kind: "pdf"; data: string }
  | { kind: "text"; name: string; text: string };

/** Claude가 입력에서 뽑아낸 와인 한 건 */
export interface ExtractedWine {
  inputName: string;
  englishName: string;
  vintage: string | null;
  priceKrw: number | null;
  note: string | null;
}

/** 결과 표의 한 행. searcherPriceKrw는 사용자가 Wine-Searcher에서 보고 입력한 평균가 */
export interface Row extends ExtractedWine {
  id: number;
  searcherPriceKrw: number | null;
}
