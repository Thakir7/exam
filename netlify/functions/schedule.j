exports.handler = async (event) => {
  const id = (event.queryStringParameters && event.queryStringParameters.id || "").trim();

  if (!id) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok:false, message:"أرسل id مثل ?id=123" })
    };
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBBqk55pwYg4D7cCu0yXfX9kc2hvGMrmxmsszYGVpFPonq9NI9WLTTlDtL8k9r0oYvQ/exec";

  try {
    const res = await fetch(`${SCRIPT_URL}?id=${encodeURIComponent(id)}`);
    const text = await res.text();
    const data = JSON.parse(text);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok:false, message:"فشل الاتصال بالخادم" })
    };
  }
};
