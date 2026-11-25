import type { InputPart } from "./types.ts";

const MAX_IMAGE_SIDE = 2000;
/** 서버리스 호스팅의 요청 크기 제한(약 4.5MB)에 맞춘 전체 입력 한도 */
export const MAX_PAYLOAD_BYTES = 4_000_000;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** 사진을 긴 변 2000px 이하 JPEG로 줄인다 (폰 사진은 원본이 너무 큼) */
async function imageToPart(file: File): Promise<InputPart> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: 이 브라우저에서 열 수 없는 이미지 형식입니다. JPG나 PNG로 올려주세요.`);
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(`${file.name}: 이미지를 변환하지 못했습니다.`);
  return { kind: "image", mediaType: "image/jpeg", data: toBase64(await blob.arrayBuffer()) };
}

async function xlsxToPart(file: File): Promise<InputPart> {
  const { default: readExcelFile } = await import("read-excel-file/browser");
  const sheets = await readExcelFile(file);
  const text = sheets
    .map(({ sheet, data }) => {
      const rows = data.map((row) => row.map((cell) => (cell == null ? "" : String(cell))).join("\t"));
      return `[시트: ${sheet}]\n${rows.join("\n")}`;
    })
    .join("\n\n");
  return { kind: "text", name: file.name, text };
}

/** 어떤 파일이든 Claude가 읽을 수 있는 조각으로 바꾼다 */
export async function fileToPart(file: File): Promise<InputPart> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/.test(name)) {
    return imageToPart(file);
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return { kind: "pdf", data: toBase64(await file.arrayBuffer()) };
  }
  if (name.endsWith(".xlsx")) return xlsxToPart(file);
  if (name.endsWith(".xls")) {
    throw new Error(`${file.name}: 구형 엑셀(.xls)은 읽을 수 없습니다. .xlsx로 저장해서 올려주세요.`);
  }
  const text = await file.text();
  if (text.includes("\u0000")) {
    throw new Error(`${file.name}: 읽을 수 없는 파일 형식입니다. 사진, PDF, 엑셀(.xlsx), 텍스트 파일을 올려주세요.`);
  }
  return { kind: "text", name: file.name, text };
}

export function partBytes(part: InputPart): number {
  return part.kind === "text" ? new Blob([part.text]).size : part.data.length;
}
