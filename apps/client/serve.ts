Bun.serve({
  port: 3001,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file('./dist/index.html'));
  },
});
