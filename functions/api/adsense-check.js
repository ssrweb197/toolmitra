import handler from "../../api/adsense-check.js";

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a valid website URL." }, { status: 400 });
  }

  let statusCode = 200;
  let payload = { error: "The scan could not be completed." };
  const responseAdapter = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    }
  };

  await handler({ body }, responseAdapter);
  return Response.json(payload, {
    status: statusCode,
    headers: { "Cache-Control": "no-store" }
  });
}
