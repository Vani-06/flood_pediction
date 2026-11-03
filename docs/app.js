(() => {
  const M = window.MODEL;
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const COL = { blue: "var(--blue)", orange: "var(--orange)", grey: "var(--grey)", ink: "var(--ink)" };

  const lnGamma = z => {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };

  const gammaP = (a, x) => {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 500; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  };

  const gammaQ = (a, x) => {
    if (x <= 0) return 1;
    if (x < a + 1) return 1 - gammaP(a, x);
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  };

  const erfc = x => {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  };

  const sf = (d, x) => {
    if (d.type === "gev") {
      const s = 1 + d.xi * (x - d.loc) / d.scale;
      if (s <= 0) return d.xi > 0 ? 1 : 0;
      return -Math.expm1(-Math.pow(s, -1 / d.xi));
    }
    if (d.type === "gumbel") return -Math.expm1(-Math.exp(-(x - d.loc) / d.scale));
    if (d.type === "gamma") return gammaQ(d.shape, x / d.scale);
    return 0.5 * erfc((x - d.mean) / (d.sd * Math.SQRT2));
  };

  const level = (d, T) => {
    let lo = -500, hi = 20000;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (sf(d, mid) > 1 / T) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  const words = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"]];
  const fmtYears = T => {
    if (!isFinite(T) || T > 1e15) {
      const e = Math.floor(Math.log10(T));
      return isFinite(T) ? `${(T / 10 ** e).toFixed(1)} × 10^${e}` : "never";
    }
    for (const [v, w] of words) if (T >= v) return `${(T / v).toFixed(T / v < 10 ? 1 : 0)} ${w}`;
    if (T >= 100) return Math.round(T).toLocaleString("en-IN");
    if (T >= 10) return T.toFixed(0);
    return T.toFixed(1);
  };
  const fmtPct = p => {
    if (p >= 0.9995) return "> 99.9%";
    if (p >= 0.1) return `${(p * 100).toFixed(1)}%`;
    if (p >= 0.001) return `${(p * 100).toFixed(2)}%`;
    if (p <= 0) return "0%";
    return `1 in ${fmtYears(1 / p)}`;
  };
  const supify = s => s.replace(/10\^(-?\d+)/, "10<sup>$1</sup>");

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const widthOf = (host, max) => Math.max(300, Math.min(max, Math.round(host.clientWidth || max)));
  const svgRoot = (host, w, h, label) => {
    host.innerHTML = "";
    return el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }, host);
  };
  const txt = (parent, x, y, s, attrs = {}) => { const t = el("text", { x, y, ...attrs }, parent); t.textContent = s; return t; };

  const tip = document.createElement("div");
  tip.className = "tip";
  document.body.appendChild(tip);
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = `${e.clientX + 12}px`; tip.style.top = `${e.clientY - 30}px`; };
  const hideTip = () => { tip.style.opacity = 0; };

  const state = { mm: 400, yrs: 30, model: "GEV", fit: "all" };
  const fitSet = () => (state.fit === "all" ? M.fits_all : M.fits_pre2005);
  const annual = M.annual;

  const hints = {
    GEV: "Recommended. Extreme-value theory's model for yearly maxima; best chi-square and AIC fit.",
    Gumbel: "Light-tailed extreme-value model (GEV with ξ = 0). Passes the fit test but under-rates the rarest storms.",
    Gamma: "The presentation's model. Fits ordinary years but its tail is too light for extremes.",
    Normal: "Rejected by every goodness-of-fit test. Shown for comparison only.",
  };

  const renderVerdicts = () => {
    const host = $("verdicts");
    const order = ["Normal", "Gamma", "Gumbel", "GEV"];
    host.innerHTML = order.map(name => {
      const row = M.gof_pre2005.find(r => r.model === name);
      const T = row["return period of 944 mm (yr)"];
      return `<div class="verdict ${name === "GEV" ? "win" : ""}"><div class="m">${name}</div><div class="t">${supify(fmtYears(T))}</div><div class="s">years · χ² p = ${row.p_chi2 < 0.001 ? "< 0.001" : row.p_chi2.toFixed(3)}</div></div>`;
    }).join("");
  };

  const renderTs = () => {
    const W = widthOf($("tsChart"), 900), narrow = W < 600, H = narrow ? 260 : 330, L = 40, R = 10, T0 = 30, B = 30;
    const svg = svgRoot($("tsChart"), W, H, "Largest one-day rainfall each year at Santacruz, 1950 to 2024");
    const x0 = 1949.5, x1 = 2024.5, yMax = 1000;
    const X = yr => L + (yr - x0) / (x1 - x0) * (W - L - R);
    const Y = v => T0 + (1 - v / yMax) * (H - T0 - B);
    const g = el("g", {}, svg);
    for (let v = 0; v <= yMax; v += 200) {
      el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gridline" }, g);
      txt(g, L - 8, Y(v) + 4, v, { "text-anchor": "end" });
    }
    for (let yr = 1950; yr <= 2020; yr += narrow ? 20 : 10) txt(g, X(yr), H - 8, yr, { "text-anchor": "middle" });
    txt(g, 4, T0 - 16, "mm");
    const bw = (W - L - R) / (x1 - x0) * 0.78;
    let hits = 0;
    annual.forEach(r => {
      const over = r.max_mm >= state.mm;
      if (over) hits += 1;
      const rect = el("rect", { x: X(r.year) - bw / 2, y: Y(r.max_mm), width: bw, height: Y(0) - Y(r.max_mm), rx: 1.5,
        fill: over ? COL.orange : COL.blue, "fill-opacity": over ? 1 : 0.55 }, svg);
      rect.addEventListener("mousemove", e => showTip(e, `<b>${r.year}</b> · ${r.max_mm} mm on ${r.date}<br>${r.very_heavy_days} very heavy days · season ${Math.round(r.total_mm).toLocaleString("en-IN")} mm`));
      rect.addEventListener("mouseleave", hideTip);
    });
    const ty = Y(Math.min(state.mm, yMax));
    el("line", { x1: L, x2: W - R, y1: ty, y2: ty, stroke: COL.orange, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svg);
    const lab = txt(svg, W - R, ty - 7, narrow ? `${state.mm} mm · ${hits}/${annual.length} years` : `${state.mm} mm · ${hits} of ${annual.length} years at or above`, { "text-anchor": "end", style: "fill: var(--orange-deep); font-weight: 600" });
    if (ty < 44) lab.setAttribute("y", ty + 16);
    el("line", { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: "axis" }, svg);
  };

  const renderCalc = () => {
    const d = fitSet()[state.model];
    const p = sf(d, state.mm);
    const T = 1 / p;
    const n = state.yrs;
    const pN = -Math.expm1(n * Math.log1p(-p));
    const obs = annual.filter(r => r.max_mm >= state.mm).length;
    $("mmOut").textContent = `${state.mm} mm`;
    $("yrsOut").textContent = `${n} year${n === 1 ? "" : "s"}`;
    $("pYear").innerHTML = supify(fmtPct(p));
    $("tYear").innerHTML = `${supify(fmtYears(T))} <small style="font-size:15px;font-weight:600">yr</small>`;
    $("pHorizonK").textContent = `Chance of at least one such day in ${n} year${n === 1 ? "" : "s"}  ·  1 − (1 − p)^${n}`;
    $("pHorizon").innerHTML = supify(fmtPct(pN));
    $("meter").style.width = `${Math.max(0.5, pN * 100)}%`;
    $("expK").textContent = `Expected number in ${n} years (np)`;
    const e = n * p;
    $("expV").innerHTML = e >= 0.01 ? e.toFixed(2) : supify(e.toExponential(1).replace(/e([+-]\d+)/, (_, x) => ` × 10^${Number(x)}`));
    $("obsV").textContent = `${obs} of ${annual.length}`;
    $("modelHint").textContent = hints[state.model];
    renderTs();
  };

  const renderRl = () => {
    const W = widthOf($("rlChart"), 900), narrow = W < 600, H = narrow ? 320 : 400, L = 42, R = 14, T0 = 26, B = 40;
    const svg = svgRoot($("rlChart"), W, H, "Return-level curves of four models fitted on 1950 to 2004 data, against the 944 mm storm of 2005");
    const lx0 = 0, lx1 = 3, yMax = 1100;
    const X = T => L + (Math.log10(T) - lx0) / (lx1 - lx0) * (W - L - R);
    const Y = v => T0 + (1 - v / yMax) * (H - T0 - B);
    for (let v = 0; v <= yMax; v += 200) {
      el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gridline" }, svg);
      txt(svg, L - 8, Y(v) + 4, v, { "text-anchor": "end" });
    }
    (narrow ? [1, 10, 100, 1000] : [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]).forEach(T => {
      el("line", { x1: X(T), x2: X(T), y1: T0, y2: Y(0), class: "gridline" }, svg);
      txt(svg, X(T), H - 20, T, { "text-anchor": "middle" });
    });
    txt(svg, (L + W - R) / 2, H - 3, "return period (years, log scale)", { "text-anchor": "middle" });
    txt(svg, 4, T0 - 12, "mm");
    el("line", { x1: L, x2: W - R, y1: Y(944), y2: Y(944), stroke: COL.orange, "stroke-width": 1.5 }, svg);
    txt(svg, L + 8, narrow ? Y(944) + 18 : Y(944) - 8, narrow ? "2005 · 944 mm" : "26 July 2005 · 944 mm", { style: "fill: var(--orange-deep); font-weight: 600" });
    const styles = { Normal: { c: COL.grey, dash: "2 4", w: 1.6 }, Gamma: { c: COL.grey, dash: "8 5", w: 1.6 }, Gumbel: { c: COL.grey, dash: "10 4 2 4", w: 1.6 }, GEV: { c: COL.blue, dash: "", w: 3 } };
    const clip = el("clipPath", { id: "rlclip" }, el("defs", {}, svg));
    el("rect", { x: L, y: T0, width: W - L - R, height: H - T0 - B }, clip);
    Object.entries(styles).forEach(([name, s]) => {
      const d = M.fits_pre2005[name];
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const T = 10 ** (0.02 + i * (3 - 0.02) / 120);
        pts.push(`${X(T).toFixed(1)},${Y(level(d, T)).toFixed(1)}`);
      }
      el("polyline", { points: pts.join(" "), fill: "none", stroke: s.c, "stroke-width": s.w, "stroke-dasharray": s.dash, "clip-path": "url(#rlclip)" }, svg);
    });
    const pre = annual.filter(r => r.year <= 2004).map(r => r.max_mm).sort((a, b) => a - b);
    const n = pre.length;
    pre.forEach((v, i) => {
      const T = (n + 1) / (n - i);
      const c = el("circle", { cx: X(T), cy: Y(v), r: 3.6, fill: "var(--ink)" }, svg);
      c.addEventListener("mousemove", e => showTip(e, `${v} mm · plotted at ${T.toFixed(1)} years`));
      c.addEventListener("mouseleave", hideTip);
    });
    const gev = M.fits_pre2005.GEV;
    const Tg = 1 / sf(gev, 944);
    el("circle", { cx: X(Tg), cy: Y(944), r: 6, fill: COL.orange, stroke: "var(--card)", "stroke-width": 2 }, svg);
    txt(svg, X(Tg) - 12, Y(944) - 8, `GEV: 1 in ${Math.round(Tg)} years`, { "text-anchor": "end", style: "fill: var(--ink); font-weight: 600" });
    el("line", { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: "axis" }, svg);
    $("rlLegend").innerHTML = Object.entries(styles).map(([k, s]) =>
      `<span><i style="background:${s.c};height:${s.w}px"></i>${k}</span>`).join("") +
      `<span><i style="background:var(--ink);width:8px;height:8px;border-radius:50%"></i>observed 1950–2004</span>`;
  };

  const pois = (k, lam) => Math.exp(-lam + k * Math.log(lam) - lnGamma(k + 1));
  const poisSfGe = (k, lam) => { let s = 0; for (let i = 0; i < k; i++) s += pois(i, lam); return Math.max(0, 1 - s); };

  const renderPois = () => {
    const lam = M.poisson.lambda_very_heavy;
    const obs = M.poisson.observed, labels = M.poisson.labels, N = obs.reduce((a, b) => a + b, 0);
    const exp = labels.map((_, i) => (i < labels.length - 1 ? pois(i, lam) : poisSfGe(i, lam)) * N);
    const W = widthOf($("poisChart"), 620), narrow = W < 480, H = 300, L = 34, R = 8, T0 = narrow ? 44 : 30, B = 36;
    const svg = svgRoot($("poisChart"), W, H, "Observed and Poisson-expected counts of very heavy rain days per monsoon");
    const yMax = 16;
    const band = (W - L - R) / labels.length;
    const Y = v => T0 + (1 - v / yMax) * (H - T0 - B);
    for (let v = 0; v <= yMax; v += 4) {
      el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gridline" }, svg);
      txt(svg, L - 8, Y(v) + 4, v, { "text-anchor": "end" });
    }
    labels.forEach((lab, i) => {
      const x = L + i * band + band * 0.12, w = band * 0.36;
      const hit = i >= state.k || (lab.endsWith("+") && state.k <= i);
      const a = el("rect", { x, y: Y(obs[i]), width: w, height: Y(0) - Y(obs[i]), rx: 2, fill: hit ? COL.orange : COL.blue, "fill-opacity": hit ? 1 : 0.6 }, svg);
      const b = el("rect", { x: x + w + 2, y: Y(exp[i]), width: w, height: Y(0) - Y(exp[i]), rx: 2, fill: COL.grey, "fill-opacity": 0.7 }, svg);
      a.addEventListener("mousemove", e => showTip(e, `${lab} days: ${obs[i]} monsoons observed`));
      b.addEventListener("mousemove", e => showTip(e, `${lab} days: ${exp[i].toFixed(1)} expected (Poisson)`));
      [a, b].forEach(r => r.addEventListener("mouseleave", hideTip));
      txt(svg, x + w + 1, H - 16, lab, { "text-anchor": "middle" });
    });
    txt(svg, (L + W - R) / 2, H - 1, "very heavy days (≥ 115.6 mm) in a monsoon", { "text-anchor": "middle" });
    txt(svg, L, 14, "■ observed", { style: "fill: var(--blue); font-weight: 600" });
    txt(svg, L + 90, 14, "■ Poisson expected", { style: "fill: var(--grey); font-weight: 600" });
    txt(svg, narrow ? L : L + 245, narrow ? 32 : 14, `■ at least ${state.k}`, { style: "fill: var(--orange); font-weight: 600" });
    el("line", { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: "axis" }, svg);
    $("lamText").textContent = lam.toFixed(2);
    $("kOut").textContent = state.k;
    $("pK").textContent = `${(poisSfGe(state.k, lam) * 100).toFixed(1)}%`;
    const allCounts = annual.map(r => r.very_heavy_days);
    $("oK").textContent = `${(allCounts.filter(c => c >= state.k).length / allCounts.length * 100).toFixed(1)}%`;
  };

  const bindSeg = (id, key) => {
    $(id).addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      [...$(id).children].forEach(c => { c.classList.toggle("on", c === b); c.setAttribute("aria-checked", c === b); });
      state[key] = b.dataset.v;
      renderCalc();
    });
  };

  $("mm").addEventListener("input", e => { state.mm = Number(e.target.value); renderCalc(); });
  $("yrs").addEventListener("input", e => { state.yrs = Number(e.target.value); renderCalc(); });
  $("presets").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    state.mm = Number(b.dataset.mm);
    $("mm").value = state.mm;
    renderCalc();
  });
  bindSeg("modelSeg", "model");
  bindSeg("fitSeg", "fit");
  state.k = 5;
  $("k").addEventListener("input", e => { state.k = Number(e.target.value); renderPois(); });

  window.FloodMath = { sf, level, fmtYears };
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { renderTs(); renderRl(); renderPois(); }, 120); });
  renderVerdicts();
  renderCalc();
  renderRl();
  renderPois();
})();
