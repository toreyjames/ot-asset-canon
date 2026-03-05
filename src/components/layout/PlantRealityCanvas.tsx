export default function PlantRealityCanvas() {
  return (
    <div className="global-canvas" aria-hidden>
      <svg className="global-canvas-svg" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M20 620 L220 560 L430 600 L620 520 L820 575 L980 470 L1200 530 L1420 460" stroke="rgba(34,211,238,0.25)" strokeWidth="2.2" strokeDasharray="8 10" />
        <path d="M40 690 L260 650 L460 700 L680 640 L890 700 L1140 660 L1400 710" stroke="rgba(59,130,246,0.22)" strokeWidth="1.8" strokeDasharray="6 8" />
        <path d="M50 470 L240 410 L440 440 L630 370 L820 420 L1040 350 L1320 390" stroke="rgba(34,211,238,0.16)" strokeWidth="1.6" strokeDasharray="7 11" />
      </svg>

      <div className="global-canvas-glow global-canvas-glow-a" />
      <div className="global-canvas-glow global-canvas-glow-b" />
      <div className="global-canvas-scan" />

      {[
        { left: "16%", top: "66%" },
        { left: "31%", top: "62%" },
        { left: "48%", top: "57%" },
        { left: "64%", top: "63%" },
        { left: "79%", top: "53%" },
      ].map((point, index) => (
        <span
          key={index}
          className="global-canvas-node"
          style={point}
        />
      ))}
    </div>
  );
}
