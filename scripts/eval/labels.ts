import sharp from "sharp";

export interface LabelContent {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  producer: string;
  countryOfOrigin?: string;
  // Set both to null to produce a label with no government warning at all.
  warningHeader: string | null;
  warningBody: string | null;
}

const WIDTH = 720;
const HEIGHT = 1000;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    if (current.length + w.length + 1 > maxChars) {
      if (current) out.push(current);
      current = w;
    } else {
      current = current ? current + " " + w : w;
    }
  }
  if (current) out.push(current);
  return out;
}

export async function renderLabel(c: LabelContent): Promise<Buffer> {
  const svg: string[] = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
  );
  // Cream label background with a dark border, evoking a typical spirits label.
  svg.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#f8f1de"/>`);
  svg.push(
    `<rect x="20" y="20" width="${WIDTH - 40}" height="${HEIGHT - 40}" fill="none" stroke="#3b2a1a" stroke-width="3"/>`,
  );

  // Brand name — large serif, the most prominent element.
  svg.push(
    `<text x="${WIDTH / 2}" y="150" text-anchor="middle" font-family="Times New Roman, serif" font-size="48" font-weight="bold" fill="#2a1a0a">${escapeXml(c.brandName)}</text>`,
  );

  // Decorative rule.
  svg.push(
    `<line x1="180" y1="180" x2="${WIDTH - 180}" y2="180" stroke="#3b2a1a" stroke-width="2"/>`,
  );

  // Class / type.
  svg.push(
    `<text x="${WIDTH / 2}" y="225" text-anchor="middle" font-family="Times New Roman, serif" font-size="24" font-style="italic" fill="#2a1a0a">${escapeXml(c.classType)}</text>`,
  );

  // Alcohol content + net contents.
  svg.push(
    `<text x="${WIDTH / 2}" y="285" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#2a1a0a">${escapeXml(c.alcoholContent)}</text>`,
  );
  svg.push(
    `<text x="${WIDTH / 2}" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#2a1a0a">${escapeXml(c.netContents)}</text>`,
  );

  // Producer.
  svg.push(
    `<text x="${WIDTH / 2}" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#2a1a0a">${escapeXml(c.producer)}</text>`,
  );
  if (c.countryOfOrigin) {
    svg.push(
      `<text x="${WIDTH / 2}" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#2a1a0a">${escapeXml(c.countryOfOrigin)}</text>`,
    );
  }

  // Government warning paragraph at the bottom. The header is rendered in
  // bold inline with the body via a <tspan>, matching how real labels
  // typeset the regulatory text (27 CFR 16.21).
  if (c.warningHeader !== null && c.warningBody !== null) {
    const full = `${c.warningHeader} ${c.warningBody}`;
    const lines = wrap(full, 70);
    const startY = 720;
    const lineH = 18;
    lines.forEach((line, i) => {
      const y = startY + i * lineH;
      if (i === 0 && line.startsWith(c.warningHeader!)) {
        const tail = line.slice(c.warningHeader!.length);
        svg.push(
          `<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#2a1a0a">` +
            `<tspan font-weight="bold">${escapeXml(c.warningHeader!)}</tspan>` +
            `${escapeXml(tail)}</text>`,
        );
      } else {
        svg.push(
          `<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#2a1a0a">${escapeXml(line)}</text>`,
        );
      }
    });
  }

  svg.push(`</svg>`);
  const svgStr = svg.join("");
  return sharp(Buffer.from(svgStr)).png().toBuffer();
}
