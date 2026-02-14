(async function () {
  // Assumes BOTH are already available globally:
  // - window.html2canvas
  // - window.jspdf (jsPDF UMD) OR window.jsPDF (some builds)
  const { jsPDF } = (window.jspdf || window);
  if (!jsPDF) throw new Error("jsPDF not found. Expected window.jspdf.jsPDF or window.jsPDF");
  if (typeof html2canvas !== "function") throw new Error("html2canvas not found on window");

  const config = {
    totalPages: 100,
    delay: 1000,
    targetId: "virtualListBody",
    navigationDelay: 500,
    // capture tuning
    scale: 2,
    backgroundColor: "#ffffff",
    imageType: "jpeg", // "jpeg" | "png"
    jpegQuality: 1, // only used if imageType === "jpeg"
    pdf: {
      orientation: "p",
      unit: "mm",
      format: "a4",
      marginMm: 0,
    },
  };

  const screenshots = []; // stores { dataUrl, wPx, hPx }
  let isCapturing = false;

  const host = document.getElementById("wc-"); // shadow host
  if (!host) console.warn('Could not find #wc- host; update "host" selector if needed.');

  const overlay = document.createElement("div");
  overlay.innerHTML = `
    <div id="screenshot-overlay" style="position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.9);color:white;padding:15px;border-radius:8px;z-index:99999;font-family:monospace;max-width:320px;">
      <div style="font-weight:bold;margin-bottom:10px;">📸 Auto Capture → PDF (html2canvas + jsPDF)</div>
      <div>Pages: <span id="page-count">0/${config.totalPages}</span></div>
      <div style="margin:5px 0;">Status: <span id="status">Ready</span></div>
      <div style="font-size:11px;color:#aaa;margin-top:10px;">
        <button id="start-btn" style="padding:5px 15px;background:#4CAF50;border:none;color:white;border-radius:3px;cursor:pointer;">Start Capture</button>
        <button id="pdf-btn" style="padding:5px 15px;background:#2196F3;border:none;color:white;border-radius:3px;cursor:pointer;margin-left:5px;">Download PDF</button>
        <button id="clear-btn" style="padding:5px 10px;background:#666;border:none;color:white;border-radius:3px;cursor:pointer;margin-left:5px;">Clear</button>
      </div>
      <div id="progress" style="margin-top:10px;font-size:10px;color:#aaa;"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const sendDownArrow = () => {
    ["keydown", "keypress", "keyup"].forEach((type) => {
      document.dispatchEvent(
        new KeyboardEvent(type, {
          key: "ArrowDown",
          code: "ArrowDown",
          keyCode: 40,
          which: 40,
          bubbles: true,
          cancelable: true,
        })
      );
    });
  };

  const getTarget = () => {
    // keep your existing assumption (shadow root). Adjust as needed.
    if (!host?.shadowRoot) return null;
    return host.shadowRoot.getElementById(config.targetId);
  };

  const captureElement = async (el) => {
    // Use html2canvas directly (no SVG foreignObject hack)
    const canvas = await html2canvas(el, {
      scale: config.scale,
      backgroundColor: config.backgroundColor,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // If your element is inside a scroller and you want only visible area,
      // keep default. If you want full element even if scrollable, html2canvas
      // usually captures the full element box.
      // scrollX: 0,
      // scrollY: -window.scrollY,
      // windowWidth: document.documentElement.clientWidth,
      // windowHeight: document.documentElement.clientHeight,
    });

    const wPx = canvas.width;
    const hPx = canvas.height;

    let dataUrl;
    if (config.imageType === "png") {
      dataUrl = canvas.toDataURL("image/png");
    } else {
      dataUrl = canvas.toDataURL("image/jpeg", config.jpegQuality);
    }

    return { dataUrl, wPx, hPx };
  };

  const updateStatus = (status, progress = "") => {
    document.getElementById("status").textContent = status;
    document.getElementById("progress").textContent = progress;
    document.getElementById("page-count").textContent = `${screenshots.length}/${config.totalPages}`;
  };

  const captureLoop = async () => {
    if (isCapturing) return;
    isCapturing = true;

    const target = getTarget();
    if (!target) {
      alert(`Element "${config.targetId}" not found (shadowRoot?).`);
      isCapturing = false;
      return;
    }

    const startBtn = document.getElementById("start-btn");
    startBtn.disabled = true;

    try {
      for (let i = 0; i < config.totalPages; i++) {
        updateStatus(`Capturing page ${i + 1}/${config.totalPages}…`, `Waiting ${config.delay}ms…`);
        await sleep(config.delay);

        updateStatus(`Capturing page ${i + 1}/${config.totalPages}…`, "Rendering…");
        const shot = await captureElement(target);
        screenshots.push(shot);

        updateStatus(`Captured ${i + 1}/${config.totalPages}`, "✓ Captured");

        if (i < config.totalPages - 1) {
          updateStatus("Navigating to next page…", `ArrowDown then wait ${config.navigationDelay}ms…`);
          sendDownArrow();
          await sleep(config.navigationDelay);
        }
      }

      updateStatus("✅ Complete!", "Ready to export PDF");
      console.log("All screenshots captured:", screenshots.length);
    } catch (e) {
      console.error(e);
      updateStatus("❌ Error", String(e?.message || e));
      alert(`Capture failed: ${e?.message || e}`);
    } finally {
      startBtn.disabled = false;
      isCapturing = false;
    }
  };

  const buildPdfFromScreenshots = () => {
    if (screenshots.length === 0) {
      alert("No screenshots captured yet!");
      return;
    }

    const pdf = new jsPDF(config.pdf.orientation, config.pdf.unit, config.pdf.format);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = config.pdf.marginMm;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const imgFormat = config.imageType.toUpperCase() === "PNG" ? "PNG" : "JPEG";

    screenshots.forEach((shot, idx) => {
      if (idx > 0) pdf.addPage();

      // Fit image to page while preserving aspect ratio
      const imgW = usableW;
      const imgH = (shot.hPx * imgW) / shot.wPx;

      // If it's taller than a page, we scale to fit height instead
      let drawW = imgW;
      let drawH = imgH;
      if (imgH > usableH) {
        drawH = usableH;
        drawW = (shot.wPx * drawH) / shot.hPx;
      }

      const x = margin + (usableW - drawW) / 2;
      const y = margin + (usableH - drawH) / 2;

      pdf.addImage(shot.dataUrl, imgFormat, x, y, drawW, drawH, undefined, "FAST");
    });

    // Download
    const filename = `capture_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`;
    pdf.save(filename);
  };

  const clearShots = () => {
    screenshots.length = 0;
    updateStatus("Ready", "Cleared screenshots");
  };

  document.getElementById("start-btn").onclick = captureLoop;
  document.getElementById("pdf-btn").onclick = buildPdfFromScreenshots;
  document.getElementById("clear-btn").onclick = clearShots;

  console.log('✅ Ready. Click "Start Capture", then "Download PDF".');
})();
