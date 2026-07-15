const backendBaseUrl = process.env.INTERNAL_API_URL ?? "http://backend:8000";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = `${backendBaseUrl.replace(/\/$/, "")}/api/${path.join("/")}${new URL(request.url).search}`;
  const headers = new Headers(request.headers);

  headers.delete("host");

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers(response.headers);

    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");

    return new Response(await response.text(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        message: "Backend-ul nu raspunde prin proxy-ul intern.",
        backendUnavailable: true,
      },
      { status: 503 },
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
