// functions/schedule.js
// Netlify Function (CommonJS) - Reads Google Sheets (CSV Published)

// ====== CSV URLs (Your published links) ======
const TRAINEES_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSefwCiYIrR_OK-O8WjwI__teY30GmMmOgJnS2oKEzAfrgDC-sqFoHBXMmXVaZ7diBmsFEWU9tKclt9/pub?gid=1412690901&single=true&output=csv";

const EXAMS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSefwCiYIrR_OK-O8WjwI__teY30GmMmOgJnS2oKEzAfrgDC-sqFoHBXMmXVaZ7diBmsFEWU9tKclt9/pub?gid=1497082494&single=true&output=csv";

// ====== helpers ======
function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}

function norm(s) {
  return String(s ?? "").trim();
}

// Simple CSV parser supporting quoted fields
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";

      // ignore completely empty rows
      if (row.some((c) => norm(c) !== "")) rows.push(row.map(norm));
      row = [];
    } else {
      cur += ch;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((c) => norm(c) !== "")) rows.push(row.map(norm));
  }

  return rows;
}

function isForbiddenStatus(status) {
  const t = norm(status);
  if (!t) return false;
  return (
    t.includes("حرمان") ||
    t.includes("مطوي") ||
    t.includes("مطوى") ||
    t.includes("مطوي قيده") ||
    t.includes("مطوى قيده")
  );
}

function addPeriod(daysMap, dayLabel, periodNo, code, nameFromExam, traineeCourses) {
  if (!daysMap.has(dayLabel)) {
    daysMap.set(dayLabel, { 1: [], 2: [], 3: [] });
  }
  const periods = daysMap.get(dayLabel);

  const t = traineeCourses.find((x) => x.courseCode === code);

  periods[periodNo].push({
    courseName: t?.courseName || nameFromExam || code,
    courseRef: code, // نرجع الرمز هنا
    status: t?.status || "",
    forbidden: !!t?.forbidden,
  });
}

// ====== handler ======
exports.handler = async (event) => {
  const id = norm(event.queryStringParameters?.id);

  // When opening function without id (like direct open), show message
  if (!id) {
    return json(400, { ok: false, message: "أرسل id في الرابط مثل ?id=123" });
  }

  try {
    // Fetch both CSVs
    const [tRes, eRes] = await Promise.all([fetch(TRAINEES_CSV), fetch(EXAMS_CSV)]);

    if (!tRes.ok) return json(500, { ok: false, message: "فشل جلب بيانات المتدربين (CSV)" });
    if (!eRes.ok) return json(500, { ok: false, message: "فشل جلب جدول الاختبارات (CSV)" });

    const [tText, eText] = await Promise.all([tRes.text(), eRes.text()]);
    const tRows = parseCSV(tText);
    const eRows = parseCSV(eText);

    // ========= 1) Read Trainees Sheet =========
    // Expected columns:
    // A: الرقم التدريبي
    // B: اسم المتدرب
    // C: حالة المتدرب
    // D: رمز المقرر
    // E: اسم المقرر
    const trainees = [];
    for (const r of tRows) {
      const trainingId = norm(r[0]);
      if (!trainingId || trainingId === "الرقم التدريبي") continue;

      trainees.push({
        trainingId,
        name: norm(r[1]),
        status: norm(r[2]),
        courseCode: norm(r[3]),
        courseName: norm(r[4]),
        forbidden: isForbiddenStatus(r[2]),
      });
    }

    const mine = trainees.filter((x) => x.trainingId === id);
    if (mine.length === 0) {
      return json(200, { ok: false, message: "لم يتم العثور على رقم تدريبي بهذا الرقم" });
    }

    // Choose name from first non-empty
    const traineeName = mine.find((x) => x.name)?.name || "";

    // Collect trainee courses by code
    const traineeCourses = mine
      .filter((x) => x.courseCode)
      .map((x) => ({
        courseCode: x.courseCode,
        courseName: x.courseName || x.courseCode,
        status: x.status || "",
        forbidden: !!x.forbidden,
      }));

    const codesSet = new Set(traineeCourses.map((x) => x.courseCode));

    // ========= 2) Read Exams Sheet =========
    // Expected columns:
    // A: اليوم/التاريخ
    // B: اسم المادة (ف1)
    // C: رمز المقرر (ف1)
    // D: اسم المادة (ف2)
    // E: رمز المقرر (ف2)
    // F: اسم المادة (ف3)
    // G: رمز المقرر (ف3)
    const daysMap = new Map();

    for (const r of eRows) {
      const dayLabel = norm(r[0]);
      if (!dayLabel || dayLabel === "اليوم") continue;

      // Period 1
      const p1Name = norm(r[1]);
      const p1Code = norm(r[2]);
      if (p1Code && codesSet.has(p1Code)) {
        addPeriod(daysMap, dayLabel, 1, p1Code, p1Name, traineeCourses);
      }

      // Period 2
      const p2Name = norm(r[3]);
      const p2Code = norm(r[4]);
      if (p2Code && codesSet.has(p2Code)) {
        addPeriod(daysMap, dayLabel, 2, p2Code, p2Name, traineeCourses);
      }

      // Period 3
      const p3Name = norm(r[5]);
      const p3Code = norm(r[6]);
      if (p3Code && codesSet.has(p3Code)) {
        addPeriod(daysMap, dayLabel, 3, p3Code, p3Name, traineeCourses);
      }
    }

    // Sort days by appearance (Map preserves insertion order)
    const days = Array.from(daysMap.entries()).map(([dayLabel, periods]) => ({
      dayLabel,
      periods,
    }));

    return json(200, {
      ok: true,
      traineeId: id,
      traineeName,
      days,
    });
  } catch (err) {
    return json(500, { ok: false, message: "حدث خطأ داخلي أثناء معالجة البيانات" });
  }
};
