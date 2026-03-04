Bun.serve({
  port: 3001,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(`./public${path}`);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file('./public/index.html'));
  },
});
