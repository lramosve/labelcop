import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LabelCop — TTB Label Compliance Verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 20,
              background: "white",
              color: "#1d4ed8",
              fontSize: 64,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            LC
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1 }}>LabelCop</div>
            <div style={{ fontSize: 32, opacity: 0.85, marginTop: 12 }}>
              TTB Label Compliance Verification
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 38, fontWeight: 600, maxWidth: 1050, lineHeight: 1.25 }}>
            Verify alcohol-beverage labels against COLA application data — fields, ABV, net contents, and the federal health warning — in about three seconds.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 24,
              opacity: 0.8,
            }}
          >
            <span>OpenAI GPT-5.4-mini</span>
            <span>·</span>
            <span>27 CFR Parts 4 / 5 / 7 / 16</span>
            <span>·</span>
            <span>labelcop.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
