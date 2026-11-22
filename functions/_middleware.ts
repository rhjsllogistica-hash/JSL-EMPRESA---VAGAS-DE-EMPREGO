interface PagesMiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

const PREVIEW_IMAGE_PATH = '/assets/whatsapp-preview-jsl.jpg';

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const origin = `${url.protocol}//${url.host}`;
  const absoluteImageUrl = `${origin}${PREVIEW_IMAGE_PATH}`;
  const canonicalUrl = `${origin}${url.pathname}`;

  let html = await response.text();
  html = html.split(`content="${PREVIEW_IMAGE_PATH}"`).join(`content="${absoluteImageUrl}"`);

  if (!html.includes('property="og:url"')) {
    html = html.replace(
      '<meta property="og:type" content="website" />',
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${canonicalUrl}" />`
    );
  }

  if (url.pathname.endsWith('/aplicativo')) {
    html = html
      .replace(
        /<title>[\s\S]*?<\/title>/,
        '<title>JSL - Processo seletivo | Baixe o Aplicativo Oficial</title>'
      )
      .replace(
        /property="og:title" content="[^"]*"/,
        'property="og:title" content="JSL - Processo seletivo | Baixe o Aplicativo Oficial"'
      )
      .replace(
        /property="og:description" content="[^"]*"/,
        'property="og:description" content="Baixe o aplicativo oficial da JSL, escolha sua vaga, preencha seus dados e participe do processo seletivo."'
      )
      .replace(
        /name="twitter:title" content="[^"]*"/,
        'name="twitter:title" content="JSL - Processo seletivo | Baixe o Aplicativo Oficial"'
      )
      .replace(
        /name="twitter:description" content="[^"]*"/,
        'name="twitter:description" content="Baixe o aplicativo oficial da JSL, escolha sua vaga, preencha seus dados e participe do processo seletivo."'
      );
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
