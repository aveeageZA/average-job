(() => {
  const networkFetch = window.fetch.bind(window);
  window.fetch = async function(input, options) {
    const address = typeof input === 'string' ? input : (input.url || String(input));
    if (!new URL(address, location.href).pathname.endsWith('/game.pck')) return networkFetch(input, options);
    const response = await networkFetch('pack-manifest.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Pacchetto di gioco non disponibile. Riprova.');
    const manifest = await response.json();
    let index = 0;
    const body = new ReadableStream({
      async pull(controller) {
        if (index === manifest.chunks.length) { controller.close(); return; }
        const part = manifest.chunks[index];
        try {
          let bytes;
          for (let attempt = 0; attempt < 3; attempt++) {
            const loaded = await networkFetch(part.file, options);
            if (!loaded.ok) { if (attempt === 2) throw new Error('Download interrotto. Ricarica la pagina.'); continue; }
            bytes = await loaded.arrayBuffer();
            if (bytes.byteLength !== part.bytes) throw new Error('Download incompleto. Ricarica la pagina.');
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
            if (hash !== part.sha256) throw new Error('Verifica del download fallita. Ricarica la pagina.');
            break;
          }
          controller.enqueue(new Uint8Array(bytes)); index++;
        } catch (error) { controller.error(error); }
      }
    });
    return new Response(body, {headers: {'Content-Type': 'application/octet-stream', 'Content-Length': String(manifest.bytes)}});
  };
})();
