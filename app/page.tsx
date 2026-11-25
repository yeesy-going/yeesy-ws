"use client";

import { useMemo, useState } from "react";
import { fileToPart, partBytes, MAX_PAYLOAD_BYTES } from "@/lib/files";
import { ratioPercent, searcherUrl, sortByRatioDesc } from "@/lib/ratio";
import type { ExtractedWine, InputPart, Row } from "@/lib/types";

const won = (value: number | null) => (value == null ? "–" : `${value.toLocaleString("ko-KR")}원`);

/** 입력 중에는 행이 움직이지 않도록, 포커스를 벗어나거나 Enter를 누를 때 값을 확정한다 */
function PriceInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (value: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : value.toLocaleString("ko-KR"));
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder="직접 입력"
      value={shown}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onBlur={() => {
        if (draft == null) return;
        const digits = draft.replace(/\D/g, "");
        onCommit(digits ? Number(digits) : null);
        setDraft(null);
      }}
    />
  );
}

function toCsv(rows: Row[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [["입력 와인명", "영어 이름", "빈티지", "내 가격", "서쳐가", "서쳐가 대비"].join(",")];
  for (const row of rows) {
    const ratio = ratioPercent(row.priceKrw, row.searcherPriceKrw);
    lines.push(
      [
        escape(row.inputName),
        escape(row.englishName),
        escape(row.vintage ?? ""),
        row.priceKrw ?? "",
        row.searcherPriceKrw ?? "",
        ratio == null ? "" : `${ratio}%`,
      ].join(","),
    );
  }
  return "﻿" + lines.join("\r\n");
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const sorted = useMemo(() => sortByRatioDesc(rows), [rows]);
  const hasInput = files.length > 0 || text.trim() !== "";

  const addFiles = (list: FileList | null) => {
    // FileList는 input 값을 비우면 같이 비워지므로 먼저 배열로 복사해 둔다
    const added = Array.from(list ?? []);
    if (added.length) setFiles((current) => [...current, ...added]);
  };

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  async function analyze() {
    setBusy(true);
    setError("");
    setRows([]);
    try {
      setStatus("파일 읽는 중…");
      const parts: InputPart[] = [];
      for (const file of files) parts.push(await fileToPart(file));
      if (text.trim()) parts.push({ kind: "text", name: "직접 입력", text: text.trim() });
      if (parts.reduce((sum, part) => sum + partBytes(part), 0) > MAX_PAYLOAD_BYTES) {
        throw new Error("입력이 너무 큽니다. 파일을 나눠서 올려주세요.");
      }

      setStatus("와인 목록 인식 중… (메뉴가 길면 1분 이상 걸릴 수 있습니다)");
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const body = (await response.json().catch(() => ({}))) as { wines?: ExtractedWine[]; error?: string };
      if (!response.ok || !body.wines) throw new Error(body.error ?? `인식 실패 (HTTP ${response.status})`);
      if (body.wines.length === 0) throw new Error("입력에서 와인을 찾지 못했습니다.");

      setRows(body.wines.map((wine, id) => ({ ...wine, id, searcherPriceKrw: null })));
      setStatus(`완료 · 와인 ${body.wines.length}종`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wine-prices.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>와인 가격 비교</h1>
      <p className="sub">메뉴판·와인병 사진, 엑셀, PDF, 텍스트 무엇이든 올리면 와인을 인식하고, Wine-Searcher 평균가를 입력하면 비율을 계산합니다.</p>

      <section className="card">
        <label
          className={over ? "drop over" : "drop"}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <strong>파일 선택 또는 사진 촬영</strong>
          여러 개를 한 번에 올릴 수 있습니다
          <input
            type="file"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {files.length > 0 && (
          <ul className="files">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                {file.name}
                <button
                  type="button"
                  aria-label={`${file.name} 제거`}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          placeholder="또는 와인 목록을 직접 붙여넣기 (예: 루이 로드레 브뤼 로제 2016  180,000)"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <div className="actions">
          <button type="button" className="btn primary" disabled={busy || !hasInput} onClick={analyze}>
            {busy ? "분석 중…" : "분석하기"}
          </button>
          <span className="status" role="status">{status}</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {sorted.length > 0 && (
        <section className="card">
          <div className="head">
            <h2>결과 (서쳐가 대비 비율 높은 순)</h2>
            <button type="button" className="btn" onClick={downloadCsv}>엑셀용 CSV 저장</button>
          </div>
          <p className="sub">영어 이름을 누르면 Wine-Searcher 페이지가 열립니다. 거기서 본 평균가를 서쳐가 칸에 입력하세요.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>입력 와인명</th>
                  <th>영어 이름</th>
                  <th className="num">내 가격</th>
                  <th className="num">서쳐가</th>
                  <th className="num">서쳐가 대비</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const ratio = ratioPercent(row.priceKrw, row.searcherPriceKrw);
                  return (
                    <tr key={row.id}>
                      <td className="name">
                        {row.inputName}
                        {row.vintage && <span className="small">{row.vintage}</span>}
                        {row.note && <span className="small">{row.note}</span>}
                      </td>
                      <td className="english">
                        <a href={searcherUrl(row.englishName)} target="_blank" rel="noreferrer">{row.englishName}</a>
                      </td>
                      <td className="num" data-label="내 가격">{won(row.priceKrw)}</td>
                      <td className="num" data-label="서쳐가">
                        <PriceInput
                          label={`${row.inputName} 서쳐가`}
                          value={row.searcherPriceKrw}
                          onCommit={(value) => updateRow(row.id, { searcherPriceKrw: value })}
                        />
                      </td>
                      <td className="num" data-label="서쳐가 대비">
                        {ratio == null ? "–" : (
                          <span className={ratio > 100 ? "ratio high" : "ratio low"}>{ratio}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
