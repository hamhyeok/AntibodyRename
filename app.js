"use strict";

const LAYOUTS = Object.freeze({
  Human: Object.freeze([
    "_Unstained(-FVD)", "_Unstained(+FVD)", "_CD3_CD5", "_CD34_CD20",
    "_CD4_CD8", "_CD19_CD45_CD47", "_Con19_Con45_Con47", "_Con4_Con8",
    "_Con3_34_Con5_20", "_CD79a", "_Con79a"
  ]),
  Canine: Object.freeze([
    "_Unstained(-FVD)", "_Unstained(FVD)", "_CD3_CD4_CD8",
    "_CD21_CD34_MHCII", "_CD5_CD45_CD14", "_Con5_Con45_Con14",
    "_Con21_Con34_ConMHCII", "_Con3_Con4_Con8", "_CD45", "_CD79a", "_Con79a"
  ]),
  Feline: Object.freeze([
    "_Unstained(-FVD)", "_Unstained(FVD)", "_CD4_CD8_CD18",
    "_CD5_CD21_CD18", "_CD3_CD14", "_Con3_Con14",
    "_Con5_Con21_Con18", "_Con4_Con8_Con18"
  ])
});

const MAX_ZIP32_SIZE = 0xffffffff;
const state = { files: [], mapping: [], ignoredCount: 0, busy: false };

const sampleInput = document.querySelector("#sample-id");
const fileInput = document.querySelector("#file-input");
const chooseButton = document.querySelector("#choose-files");
const dropZone = document.querySelector("#drop-zone");
const message = document.querySelector("#message");
const previewSection = document.querySelector("#preview-section");
const mappingBody = document.querySelector("#mapping-body");
const fileSummary = document.querySelector("#file-summary");
const resetButton = document.querySelector("#reset-button");
const downloadButton = document.querySelector("#download-button");
const steps = [...document.querySelectorAll(".step")];

function selectedPanel() {
  return document.querySelector('input[name="panel"]:checked').value;
}

function setPanel(name) {
  const radio = document.querySelector(`input[name="panel"][value="${name}"]`);
  if (radio) radio.checked = true;
}

function inferPanel(sampleId) {
  if (/^AS/i.test(sampleId)) return "Human";
  if (/^C/i.test(sampleId)) return "Canine";
  if (/^F/i.test(sampleId)) return "Feline";
  return null;
}

function getExtension(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1) : "";
}

function compareNames(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function validateAndMap() {
  const sampleId = sampleInput.value.trim();
  const panel = selectedPanel();
  const required = LAYOUTS[panel].length;

  if (!state.files.length) return { error: "" };
  if (!sampleId) return { error: "Sample ID를 입력하세요." };
  if (!/^[A-Za-z0-9_-]+$/.test(sampleId)) {
    return { error: "Sample ID에는 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다." };
  }

  const names = state.files.map(file => file.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    return { error: `같은 이름의 원본 파일이 있습니다: ${[...new Set(duplicateNames)].join(", ")}` };
  }

  const matching = state.files.filter(file => file.name.includes(sampleId)).sort(compareNames);
  state.ignoredCount = state.files.length - matching.length;

  if (!matching.length) return { error: `파일명에 Sample ID “${sampleId}”가 포함된 파일이 없습니다.` };
  if (matching.length !== required) {
    return { error: `${panel} 패널은 ${required}개 파일이 필요합니다. Sample ID와 일치하는 파일은 현재 ${matching.length}개입니다.` };
  }

  const missingExtension = matching.find(file => !getExtension(file.name));
  if (missingExtension) return { error: `확장자가 없는 파일이 있습니다: ${missingExtension.name}` };
  if (matching.some(file => file.size > MAX_ZIP32_SIZE)) {
    return { error: "4 GB를 초과하는 개별 파일은 이 ZIP 형식으로 처리할 수 없습니다." };
  }

  const mapping = matching.map((file, index) => ({
    file,
    original: file.name,
    renamed: `${sampleId}${LAYOUTS[panel][index]}.${getExtension(file.name)}`
  }));
  const renamed = mapping.map(item => item.renamed);
  if (new Set(renamed).size !== renamed.length) return { error: "변경 후 파일명이 중복됩니다." };

  const estimatedSize = mapping.reduce((sum, item) => sum + item.file.size + item.renamed.length + 180, 0);
  if (estimatedSize > MAX_ZIP32_SIZE) {
    return { error: "전체 ZIP 예상 크기가 4 GB를 초과합니다. 파일을 나누어 처리하세요." };
  }
  return { mapping };
}

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = !text;
}

function updateSteps(hasFiles, valid) {
  steps.forEach(step => step.classList.remove("is-active"));
  steps[valid ? 2 : hasFiles ? 1 : 0].classList.add("is-active");
}

function render() {
  const result = validateAndMap();
  const hasFiles = state.files.length > 0;
  state.mapping = result.mapping || [];

  resetButton.disabled = !hasFiles && !sampleInput.value;
  downloadButton.disabled = !state.mapping.length || state.busy;
  previewSection.hidden = !state.mapping.length;
  mappingBody.replaceChildren();

  if (result.error) {
    showMessage(result.error, "error");
  } else if (state.mapping.length && state.ignoredCount) {
    showMessage(`선택한 ${state.files.length}개 중 Sample ID와 일치하지 않는 ${state.ignoredCount}개 파일은 제외됩니다.`, "warning");
  } else if (state.mapping.length) {
    showMessage(`${selectedPanel()} 패널 ${state.mapping.length}개 파일의 매핑이 준비되었습니다.`, "success");
  } else {
    showMessage("");
  }

  for (const [index, item] of state.mapping.entries()) {
    const row = document.createElement("tr");
    for (const value of [String(index + 1), item.original, item.renamed]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    mappingBody.append(row);
  }

  if (state.mapping.length) {
    const bytes = state.mapping.reduce((sum, item) => sum + item.file.size, 0);
    fileSummary.textContent = `${state.mapping.length}개 · ${formatBytes(bytes)}`;
  }
  updateSteps(hasFiles, state.mapping.length > 0);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function acceptFiles(fileList) {
  state.files = [...fileList].filter(file => file instanceof File);
  fileInput.value = "";
  render();
  if (state.files.length) previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

sampleInput.addEventListener("input", () => {
  const inferred = inferPanel(sampleInput.value.trim());
  if (inferred) setPanel(inferred);
  render();
});
document.querySelector("#panel-options").addEventListener("change", render);
chooseButton.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", event => {
  if (!event.target.closest("button")) fileInput.click();
});
fileInput.addEventListener("change", () => acceptFiles(fileInput.files));

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}
dropZone.addEventListener("drop", event => acceptFiles(event.dataTransfer.files));

resetButton.addEventListener("click", () => {
  state.files = [];
  state.mapping = [];
  state.ignoredCount = 0;
  sampleInput.value = "";
  fileInput.value = "";
  setPanel("Human");
  render();
  sampleInput.focus();
});

downloadButton.addEventListener("click", async () => {
  const result = validateAndMap();
  if (!result.mapping) return render();

  state.busy = true;
  downloadButton.disabled = true;
  const label = downloadButton.querySelector("span");
  const originalLabel = label.textContent;
  try {
    const entries = result.mapping.map(item => ({
      name: `ReName Rawdata/${item.renamed}`,
      file: item.file
    }));
    const zipBlob = await createStoredZip(entries, (done, total) => {
      label.textContent = `ZIP 생성 중 ${done}/${total}`;
    });
    const sampleId = sampleInput.value.trim();
    downloadBlob(zipBlob, `${sampleId}_ReName_Rawdata.zip`);
    showMessage("ZIP 파일을 생성했습니다. 원본 파일은 변경되지 않았습니다.", "success");
  } catch (error) {
    console.error(error);
    showMessage(`ZIP 생성에 실패했습니다: ${error.message}`, "error");
  } finally {
    state.busy = false;
    label.textContent = originalLabel;
    downloadButton.disabled = !state.mapping.length;
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Dependency-free ZIP writer using the standard "store" method (no compression).
// This keeps the app fully static and avoids sending files to a server or CDN library.
async function createStoredZip(entries, onProgress = () => {}) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralSize = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const name = encoder.encode(entry.name);
    const size = entry.file.size;
    const checksum = crc32(new Uint8Array(await entry.file.arrayBuffer()));
    const { time, date } = dosDateTime(entry.file.lastModified || Date.now());

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, entry.file);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + size;
    centralSize += central.length;
    onProgress(index + 1, entries.length);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function dosDateTime(timestamp) {
  const dateObject = new Date(timestamp);
  const year = Math.max(1980, dateObject.getFullYear());
  return {
    time: (dateObject.getHours() << 11) | (dateObject.getMinutes() << 5) | Math.floor(dateObject.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((dateObject.getMonth() + 1) << 5) | dateObject.getDate()
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

render();
