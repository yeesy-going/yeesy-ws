import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractedWine, InputPart } from "./types.ts";

const WineListSchema = z.object({
  wines: z.array(
    z.object({
      input_name: z.string(),
      english_name: z.string(),
      vintage: z.string().nullable(),
      price_krw: z.number().nullable(),
      note: z.string().nullable(),
    }),
  ),
});

const SYSTEM = `You read whatever a user hands over about wines — photos of a restaurant or shop wine list, photos of bottles or labels, spreadsheet contents, PDFs, or free text — and return every wine in it as structured data. The result feeds a price lookup on Wine-Searcher, so the English name must be something Wine-Searcher's search will match.

For each distinct wine return:
- input_name: the wine's name as it appears in the source, in the source's own language and spelling (Korean stays Korean). For a bottle photo, use the main label text.
- english_name: the name the way Wine-Searcher lists it — producer, then cuvée or vineyard, then appellation or region, then country — in Latin script and without the vintage. Example: "Louis Roederer Brut Rose Millesime, Champagne, France". Resolve transliterated or abbreviated names to the real producer and wine using your wine knowledge and the surrounding context (section headings such as region or grape help).
- vintage: the four-digit year if shown, "NV" if marked non-vintage, otherwise null.
- price_krw: the price shown for that wine as an integer number of Korean won, or null when no price is shown. Wine lists often abbreviate (e.g. "12.5" or "125" meaning 125,000원); work out the convention from the list as a whole and apply it consistently. When both glass and bottle prices appear, use the bottle price. If the price is in another currency, return null and say so in note.
- note: null unless something affects the price comparison — a non-750ml format (half bottle, magnum), a glass-only price, a foreign-currency price, or a name you could not identify with confidence.

Include only wines (still, sparkling, fortified, sake and spirits are fine if listed as bottles). Skip food, section headings and anything that is not a product. If the input contains no wines, return an empty list.`;

function toContent(parts: InputPart[]): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const part of parts) {
    if (part.kind === "image") {
      content.push({ type: "image", source: { type: "base64", media_type: part.mediaType, data: part.data } });
    } else if (part.kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: part.data } });
    } else {
      content.push({ type: "text", text: `<file name="${part.name}">\n${part.text}\n</file>` });
    }
  }
  content.push({ type: "text", text: "Extract every wine from the material above." });
  return content;
}

export async function extractWines(parts: InputPart[]): Promise<ExtractedWine[]> {
  const client = new Anthropic();
  // 메뉴가 길면 출력이 커지므로 스트리밍으로 받아 타임아웃을 피한다.
  // fallbacks: 모델이 드물게 요청을 거절할 때 서버가 다른 모델로 같은 요청을 다시 처리한다.
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(WineListSchema) },
    messages: [{ role: "user", content: toContent(parts) }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("모델이 이 입력의 처리를 거절했습니다.");
  if (message.stop_reason === "max_tokens") throw new Error("와인이 너무 많아 한 번에 처리하지 못했습니다. 나눠서 올려주세요.");

  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("모델 응답이 비어 있습니다.");
  const parsed = WineListSchema.parse(JSON.parse(text.text));

  return parsed.wines.map((wine) => ({
    inputName: wine.input_name,
    englishName: wine.english_name,
    vintage: wine.vintage,
    priceKrw: wine.price_krw == null ? null : Math.round(wine.price_krw),
    note: wine.note,
  }));
}
