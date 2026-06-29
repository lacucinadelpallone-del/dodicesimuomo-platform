const DU_LOGO = '/logos/du-logo.png';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossibile caricare: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLogoWithBg(ctx, img, x, y, size) {
  const pad = 7;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#010c1a';
  roundRect(ctx, x - pad, y - pad, size + pad * 2, size + pad * 2, 10);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(img, x, y, size, size);
}

export async function overlayLogos(generatedDataUrl, { compLogo = null, homeLogo = null, awayLogo = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // 1. Immagine base DALL-E
  const base = await loadImage(generatedDataUrl);
  ctx.drawImage(base, 0, 0, 1024, 1024);

  // 2. D|U brand — angolo alto sinistra
  try {
    const du = await loadImage(DU_LOGO);
    drawLogoWithBg(ctx, du, 18, 18, 88);
  } catch (_) {}

  // 3. Logo competizione — angolo alto destra
  if (compLogo) {
    try {
      const comp = await loadImage(compLogo);
      drawLogoWithBg(ctx, comp, 1024 - 80 - 22, 22, 80);
    } catch (_) {}
  }

  // 4. Logo squadra casa — angolo basso sinistra
  if (homeLogo) {
    try {
      const home = await loadImage(homeLogo);
      drawLogoWithBg(ctx, home, 16, 1024 - 72 - 16, 72);
    } catch (_) {}
  }

  // 5. Logo squadra ospite — angolo basso destra
  if (awayLogo) {
    try {
      const away = await loadImage(awayLogo);
      drawLogoWithBg(ctx, away, 1024 - 72 - 16, 1024 - 72 - 16, 72);
    } catch (_) {}
  }

  return canvas.toDataURL('image/png');
}
