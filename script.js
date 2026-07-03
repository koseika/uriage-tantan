// 売上記録タンタン Ver1.2
// 会計処理は行わず、日々の記録とCSV出力に役割を限定する。

const STORAGE_KEY = "tantanRecordsV1";

// Ver1では管理画面を作らず、取引先マスタは配列で管理する。
const partners = [
  {
    id: "sakaisuji_honmachi_3",
    label: "堺筋本町③",
    freeeName: "堺筋本町③",
    defaultTransportation: 480,
  },
  {
    id: "kyoto",
    label: "京都",
    freeeName: "京都",
    defaultTransportation: 1680,
  },
  {
    id: "misc_honmachi",
    label: "雑収入（本町）",
    freeeName: "雑収入（本町）",
    defaultTransportation: 480,
  },
];

const expenseCategories = [
  "交通費",
  "消耗品",
  "新聞図書費",
  "地代家賃",
  "研修費",
  "通信費",
  "水道光熱費",
  "手数料",
  "その他",
];

const accountTitleMap = {
  交通費: "旅費交通費",
  消耗品: "消耗品費",
  新聞図書費: "新聞図書費",
  地代家賃: "地代家賃",
  研修費: "研修費",
  通信費: "通信費",
  水道光熱費: "水道光熱費",
  手数料: "支払手数料",
  その他: "雑費",
};

// freeeのエクセルインポート用サンプルファイルに合わせるための設定。
// 税区分などがfreee側の運用と違う場合は、まずここだけ修正する。
const freeeConfig = {
  incomeTaxCategory: "課税売上10%",
  expenseTaxCategory: "課対仕入10%",
  taxCalculationType: "税込",
  settlementAccount: "現金",
};

// freeeサンプルファイルの列順。CSV出力はこの並びで作成する。
const freeeHeaders = [
  "収支区分",
  "管理番号",
  "発生日",
  "決済期日",
  "取引先",
  "取引先コード",
  "勘定科目",
  "税区分",
  "金額",
  "税計算区分",
  "税額",
  "備考",
  "品目",
  "部門",
  "メモタグ（複数指定可、カンマ区切り）",
  "決済日",
  "決済口座",
  "決済金額",
  "セグメント1",
  "セグメント2",
  "セグメント3",
];

let records = [];

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  initializeDates();
  populatePartnerSelects();
  populateCategorySelects();
  records = loadData();
  bindEvents();
  render();
});

function bindElements() {
  els.mainForm = document.getElementById("mainForm");
  els.mainDate = document.getElementById("mainDate");
  els.mainPartner = document.getElementById("mainPartner");
  els.mainIncome = document.getElementById("mainIncome");
  els.mainTransport = document.getElementById("mainTransport");
  els.mainMemo = document.getElementById("mainMemo");
  els.mainMessage = document.getElementById("mainMessage");

  els.expenseForm = document.getElementById("expenseForm");
  els.expenseDate = document.getElementById("expenseDate");
  els.expenseCategory = document.getElementById("expenseCategory");
  els.expensePartner = document.getElementById("expensePartner");
  els.expenseAmount = document.getElementById("expenseAmount");
  els.expenseMemo = document.getElementById("expenseMemo");
  els.expenseMessage = document.getElementById("expenseMessage");

  els.monthFilter = document.getElementById("monthFilter");
  els.summaryIncome = document.getElementById("summaryIncome");
  els.summaryExpense = document.getElementById("summaryExpense");
  els.summaryProfit = document.getElementById("summaryProfit");
  els.categorySummary = document.getElementById("categorySummary");
  els.recordList = document.getElementById("recordList");

  els.downloadFreeeIncomeCsv = document.getElementById("downloadFreeeIncomeCsv");
  els.downloadFreeeExpenseCsv = document.getElementById("downloadFreeeExpenseCsv");
  els.downloadBackupCsv = document.getElementById("downloadBackupCsv");
  els.backupImport = document.getElementById("backupImport");
  els.csvMessage = document.getElementById("csvMessage");

  els.editModal = document.getElementById("editModal");
  els.editForm = document.getElementById("editForm");
  els.editId = document.getElementById("editId");
  els.editDate = document.getElementById("editDate");
  els.editType = document.getElementById("editType");
  els.editPartner = document.getElementById("editPartner");
  els.editCategory = document.getElementById("editCategory");
  els.editCategoryLabel = document.getElementById("editCategoryLabel");
  els.editAmount = document.getElementById("editAmount");
  els.editMemo = document.getElementById("editMemo");
  els.cancelEdit = document.getElementById("cancelEdit");
}

function initializeDates() {
  const today = new Date();
  const todayText = formatDateForInput(today);
  const monthText = todayText.slice(0, 7);

  els.mainDate.value = todayText;
  els.expenseDate.value = todayText;
  els.monthFilter.value = monthText;
}

function populatePartnerSelects() {
  setPartnerOptions(els.mainPartner, false);
  setPartnerOptions(els.expensePartner, true);
  setPartnerOptions(els.editPartner, true);
  updateDefaultTransportation();
}

function setPartnerOptions(select, includeEmpty) {
  select.innerHTML = "";

  if (includeEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "選択なし";
    select.appendChild(empty);
  }

  partners.forEach((partner) => {
    const option = document.createElement("option");
    option.value = partner.id;
    option.textContent = partner.label;
    select.appendChild(option);
  });
}

function populateCategorySelects() {
  setCategoryOptions(els.expenseCategory);
  setCategoryOptions(els.editCategory);
}

function setCategoryOptions(select) {
  select.innerHTML = "";
  expenseCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function bindEvents() {
  els.mainPartner.addEventListener("change", updateDefaultTransportation);
  els.mainForm.addEventListener("submit", handleMainSubmit);
  els.expenseForm.addEventListener("submit", handleExpenseSubmit);
  els.monthFilter.addEventListener("change", render);

  els.downloadFreeeIncomeCsv.addEventListener("click", () => downloadFreeeCsvByType("income"));
  els.downloadFreeeExpenseCsv.addEventListener("click", () => downloadFreeeCsvByType("expense"));
  els.downloadBackupCsv.addEventListener("click", downloadBackupCsv);
  els.backupImport.addEventListener("change", importBackupCsv);

  els.editForm.addEventListener("submit", handleEditSubmit);
  els.editType.addEventListener("change", updateEditCategoryVisibility);
  els.cancelEdit.addEventListener("click", closeEditModal);
  els.editModal.addEventListener("click", (event) => {
    if (event.target === els.editModal) closeEditModal();
  });
}

// 将来クラウド保存へ移行しやすいよう、保存処理は関数に分離する。
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("データ読み込みに失敗しました", error);
    return [];
  }
}

function updateDefaultTransportation() {
  const partner = findPartner(els.mainPartner.value);
  els.mainTransport.value = partner ? partner.defaultTransportation : "";
}

function handleMainSubmit(event) {
  event.preventDefault();

  const date = els.mainDate.value;
  const partner = findPartner(els.mainPartner.value);
  const incomeAmount = parseAmount(els.mainIncome.value);
  const transportAmount = parseAmount(els.mainTransport.value);
  const memo = els.mainMemo.value.trim();

  if (!date || !partner) {
    showMessage(els.mainMessage, "日付と取引先を入力してください。", "error");
    return;
  }

  if (incomeAmount <= 0 && transportAmount <= 0) {
    showMessage(els.mainMessage, "売上金額か交通費のどちらかを入力してください。", "error");
    return;
  }

  const groupId = createId();
  const newRecords = [];

  if (incomeAmount > 0) {
    newRecords.push(createRecord({
      date,
      type: "income",
      partner,
      amount: incomeAmount,
      category: "売上",
      accountTitle: "売上高",
      memo,
      sourceGroupId: groupId,
    }));
  }

  if (transportAmount > 0) {
    newRecords.push(createRecord({
      date,
      type: "expense",
      partner,
      amount: transportAmount,
      category: "交通費",
      accountTitle: accountTitleMap["交通費"],
      memo,
      sourceGroupId: groupId,
    }));
  }

  records = records.concat(newRecords);
  saveData();
  resetMainFormKeepDateAndPartner();
  render();
  showMessage(els.mainMessage, "登録しました。", "success");
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const date = els.expenseDate.value;
  const category = els.expenseCategory.value;
  const partner = findPartner(els.expensePartner.value);
  const amount = parseAmount(els.expenseAmount.value);
  const memo = els.expenseMemo.value.trim();

  if (!date || !category || amount <= 0) {
    showMessage(els.expenseMessage, "日付・経費カテゴリ・金額を入力してください。", "error");
    return;
  }

  records.push(createRecord({
    date,
    type: "expense",
    partner,
    amount,
    category,
    accountTitle: accountTitleMap[category] || "雑費",
    memo,
    sourceGroupId: createId(),
  }));

  saveData();
  els.expenseAmount.value = "";
  els.expenseMemo.value = "";
  render();
  showMessage(els.expenseMessage, "経費を追加しました。", "success");
}

function createRecord({ date, type, partner, amount, category, accountTitle, memo, sourceGroupId }) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    date,
    type,
    partnerId: partner ? partner.id : "",
    partnerName: partner ? partner.label : "",
    freeePartnerName: partner ? partner.freeeName : "",
    amount,
    category,
    accountTitle,
    memo: memo || "",
    sourceGroupId,
    createdAt: now,
    updatedAt: now,
  };
}

function resetMainFormKeepDateAndPartner() {
  els.mainIncome.value = "";
  els.mainMemo.value = "";
  updateDefaultTransportation();
}

function render() {
  const filtered = getFilteredRecords();
  renderSummary(filtered);
  renderRecordList(filtered);
}

function getFilteredRecords() {
  const month = els.monthFilter.value;
  return records
    .filter((record) => !month || record.date.startsWith(month))
    .sort((a, b) => {
      if (a.date === b.date) return a.createdAt.localeCompare(b.createdAt);
      return b.date.localeCompare(a.date);
    });
}

function renderSummary(filtered) {
  const incomeTotal = filtered
    .filter((record) => record.type === "income")
    .reduce((sum, record) => sum + Number(record.amount), 0);

  const expenseTotal = filtered
    .filter((record) => record.type === "expense")
    .reduce((sum, record) => sum + Number(record.amount), 0);

  els.summaryIncome.textContent = formatYen(incomeTotal);
  els.summaryExpense.textContent = formatYen(expenseTotal);
  els.summaryProfit.textContent = formatYen(incomeTotal - expenseTotal);

  const byCategory = {};
  filtered
    .filter((record) => record.type === "expense")
    .forEach((record) => {
      byCategory[record.category] = (byCategory[record.category] || 0) + Number(record.amount);
    });

  const rows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `<div><span>${escapeHtml(category)}</span><strong>${formatYen(amount)}</strong></div>`)
    .join("");

  els.categorySummary.innerHTML = rows || "<p class=\"note\">この月の経費はまだありません。</p>";
}

function renderRecordList(filtered) {
  if (filtered.length === 0) {
    els.recordList.innerHTML = "<p class=\"note\">この月の記録はまだありません。</p>";
    return;
  }

  els.recordList.innerHTML = filtered.map((record) => {
    const typeLabel = record.type === "income" ? "売上" : record.category;
    const amountClass = record.type === "income" ? "income" : "expense";
    const sign = record.type === "income" ? "+" : "-";
    const partnerText = record.partnerName ? ` / ${record.partnerName}` : "";
    const memoText = record.memo ? `<p class="record-meta">メモ：${escapeHtml(record.memo)}</p>` : "";

    return `
      <article class="record-item">
        <div class="record-main">
          <div>
            <p class="record-title">${escapeHtml(record.date)} ${escapeHtml(typeLabel)}</p>
            <p class="record-meta">${escapeHtml(record.accountTitle || "")}${escapeHtml(partnerText)}</p>
            ${memoText}
          </div>
          <div class="record-amount ${amountClass}">${sign}${formatYen(record.amount)}</div>
        </div>
        <div class="record-actions">
          <button type="button" class="secondary-button" onclick="openEditModal('${record.id}')">編集</button>
          <button type="button" class="delete-button" onclick="deleteRecord('${record.id}')">削除</button>
        </div>
      </article>
    `;
  }).join("");
}

function openEditModal(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  els.editId.value = record.id;
  els.editDate.value = record.date;
  els.editType.value = record.type;
  els.editPartner.value = record.partnerId || "";
  els.editCategory.value = record.category && record.type === "expense" ? record.category : "交通費";
  els.editAmount.value = record.amount;
  els.editMemo.value = record.memo || "";
  updateEditCategoryVisibility();
  els.editModal.classList.remove("hidden");
}

function closeEditModal() {
  els.editModal.classList.add("hidden");
}

function updateEditCategoryVisibility() {
  els.editCategoryLabel.style.display = els.editType.value === "expense" ? "grid" : "none";
}

function handleEditSubmit(event) {
  event.preventDefault();

  const id = els.editId.value;
  const recordIndex = records.findIndex((item) => item.id === id);
  if (recordIndex === -1) return;

  const type = els.editType.value;
  const partner = findPartner(els.editPartner.value);
  const category = type === "income" ? "売上" : els.editCategory.value;
  const amount = parseAmount(els.editAmount.value);

  if (!els.editDate.value || amount <= 0) {
    alert("日付と金額を入力してください。");
    return;
  }

  records[recordIndex] = {
    ...records[recordIndex],
    date: els.editDate.value,
    type,
    partnerId: partner ? partner.id : "",
    partnerName: partner ? partner.label : "",
    freeePartnerName: partner ? partner.freeeName : "",
    amount,
    category,
    accountTitle: type === "income" ? "売上高" : accountTitleMap[category] || "雑費",
    memo: els.editMemo.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  saveData();
  closeEditModal();
  render();
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  const ok = confirm(`${record.date}の記録を削除しますか？`);
  if (!ok) return;

  records = records.filter((item) => item.id !== id);
  saveData();
  render();
}

// freee用CSV。freeeのエクセルインポート用サンプルファイルと同じ21列で出力する。
// 金額はサンプルに合わせて、収入・支出ともプラス値で出力する。
// もしfreee側で「支出はマイナス金額」として取り込む画面を使う場合は、
// buildFreeeRow() の amount 部分だけを調整すればよい。
function buildFreeeCsvRows(targetRecords) {
  const rows = targetRecords
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(buildFreeeRow);

  return [freeeHeaders, ...rows];
}

function buildFreeeRow(record) {
  const isIncome = record.type === "income";
  const partnerName = record.freeePartnerName || record.partnerName || "";
  const amount = Math.abs(Number(record.amount || 0));
  const taxCategory = isIncome
    ? freeeConfig.incomeTaxCategory
    : freeeConfig.expenseTaxCategory;

  return [
    isIncome ? "収入" : "支出",                  // 収支区分
    "",                                           // 管理番号
    record.date,                                  // 発生日
    "",                                           // 決済期日
    partnerName,                                  // 取引先
    "",                                           // 取引先コード
    record.accountTitle || (isIncome ? "売上高" : "雑費"), // 勘定科目
    taxCategory,                                  // 税区分
    amount,                                       // 金額
    freeeConfig.taxCalculationType,               // 税計算区分
    "",                                           // 税額。freee側で自動計算・確認する前提
    record.memo || "",                            // 備考
    record.category || "",                        // 品目
    "",                                           // 部門
    "",                                           // メモタグ
    record.date,                                  // 決済日
    freeeConfig.settlementAccount,                // 決済口座
    amount,                                       // 決済金額
    "",                                           // セグメント1
    "",                                           // セグメント2
    "",                                           // セグメント3
  ];
}

function downloadFreeeCsvByType(type) {
  const filtered = getFilteredRecords()
    .filter((record) => record.type === type)
    .slice()
    .reverse();

  if (filtered.length === 0) {
    const label = type === "income" ? "収入" : "支出";
    showMessage(els.csvMessage, `出力する${label}データがありません。`, "error");
    return;
  }

  const rows = buildFreeeCsvRows(filtered);
  const month = els.monthFilter.value || "all";
  const filePrefix = type === "income" ? "freee_income_tantan" : "freee_expense_tantan";
  const label = type === "income" ? "収入" : "支出";
  const fileName = `${filePrefix}_${month}.csv`;

  downloadCsv(rows, fileName);
  const count = filtered.length;
  showMessage(els.csvMessage, `freee${label}CSVを作成しました。${count}件出力しました。`, "success");
}

function buildBackupCsvRows(targetRecords) {
  const headers = [
    "id",
    "date",
    "type",
    "partnerId",
    "partnerName",
    "freeePartnerName",
    "amount",
    "category",
    "accountTitle",
    "memo",
    "sourceGroupId",
    "createdAt",
    "updatedAt",
  ];

  const rows = targetRecords
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => headers.map((key) => record[key] ?? ""));

  return [headers, ...rows];
}

function downloadBackupCsv() {
  if (records.length === 0) {
    showMessage(els.csvMessage, "バックアップするデータがありません。", "error");
    return;
  }

  const rows = buildBackupCsvRows(records);
  const fileName = `tantan_backup_${formatDateForInput(new Date())}.csv`;
  downloadCsv(rows, fileName);
  showMessage(els.csvMessage, "バックアップCSVを出力しました。", "success");
}

function importBackupCsv(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = parseBackupCsv(reader.result);
      const existingIds = new Set(records.map((record) => record.id));
      const newItems = imported.filter((record) => !existingIds.has(record.id));

      records = records.concat(newItems);
      saveData();
      render();
      showMessage(els.csvMessage, `${newItems.length}件を読み込みました。`, "success");
    } catch (error) {
      console.error(error);
      showMessage(els.csvMessage, "CSVの読み込みに失敗しました。", "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "UTF-8");
}

function parseBackupCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] ?? "";
    });
    item.amount = Number(item.amount || 0);
    return item;
  });
}

function downloadCsv(rows, fileName) {
  const csvText = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// ダブルクォート対応の簡易CSVパーサー。
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function findPartner(id) {
  return partners.find((partner) => partner.id === id) || null;
}

function parseAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.floor(number) : 0;
}

function formatYen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
  window.setTimeout(() => {
    element.textContent = "";
    element.className = "message";
  }, 3500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
