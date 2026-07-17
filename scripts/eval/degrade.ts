/**
 * Applies realistic photo-capture defects to a rendered label PNG so the
 * eval can validate against imperfect inputs (angle, blur, glare/low light)
 * instead of only pristine synthetic renders. Built on sharp, already a
 * project devDependency.
 */

import sharp from "sharp";

export async function photographedAtAngle(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .rotate(7, { background: "#f8f1de" })
    .jpeg({ quality: 70 })
    .toBuffer();
}

export async function glareAndLowLight(png: Buffer): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const width = meta.width ?? 720;
  const height = meta.height ?? 1000;

  // Simulate glare: a soft white ellipse overlay in one corner.
  const glareSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <radialGradient id="g" cx="30%" cy="20%" r="45%">
        <stop offset="0%" stop-color="white" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
  </svg>`;

  return sharp(png)
    .modulate({ brightness: 0.72 }) // low light
    .composite([{ input: Buffer.from(glareSvg), blend: "screen" }])
    .blur(1.2)
    .jpeg({ quality: 65 })
    .toBuffer();
}

export async function blurryShot(png: Buffer): Promise<Buffer> {
  return sharp(png).blur(4).jpeg({ quality: 60 }).toBuffer();
}
