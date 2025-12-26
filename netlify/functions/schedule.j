export async function handler(event) {
  const id = (event.queryStringParameters?.id || "").trim();
  if (!id) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok:false, message:"أرسل id مثل ?id=123" })
    };
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBBqk55pwYg4D7cCu0yXfX9kc2hvGMrmxmsszYGVpFPonq9NI9WLTTlDtL8k9r0oYvQ/exec";

  try {
    const res = await fetch(`${SCRIPT_URL}?id=${encodeURIComponent(id)}`);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok:false, message:"فشل الاتصال بالخادم" })
    };
  }
}
