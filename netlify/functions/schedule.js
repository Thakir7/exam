export async function handler(event) {
  const id = event.queryStringParameters?.id;

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, message: "أرسل id في الرابط مثل ?id=123" })
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ok: true,
      traineeId: id,
      traineeName: "اختبار ناجح",
      days: []
    })
  };
}

