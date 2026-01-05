const app = document.getElementById("app");
let token = null;
let pricing = null;

function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function numberVal(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function renderLogin() {
  app.innerHTML = "";
  const node = el(`
    <div style="max-width:900px;margin:24px auto;font-family:Arial">
      <h2>Pricing Admin</h2>
      <p>Enter the manager password.</p>
      <input id="pw" type="password" placeholder="Password" style="width:100%;padding:10px;font-size:16px" />
      <button id="btn" style="margin-top:12px;padding:10px 14px;font-size:16px">Login</button>
      <p id="msg" style="color:#b00;margin-top:10px"></p>
    </div>
  `);
  app.appendChild(node);

  node.querySelector("#btn").onclick = async () => {
    node.querySelector("#msg").textContent = "";
    try {
      const password = node.querySelector("#pw").value;
      const out = await api("/.netlify/functions/admin_login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      token = out.token;
      await loadPricingAndRender();
    } catch (e) {
      node.querySelector("#msg").textContent = "Login failed.";
      console.error(e);
    }
  };
}

async function loadPricingAndRender() {
  pricing = await api("/.netlify/functions/pricing_get", { cache: "no-store" });
  renderEditor();
}

function renderEditor() {
  app.innerHTML = "";

  const node = el(`
    <div style="max-width:1100px;margin:24px auto;font-family:Arial">
      <h2>Pricing Admin</h2>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
        <label>Tax rate
          <input id="tax" type="number" step="0.0001" style="margin-left:8px" />
        </label>
        <label>Corner price
          <input id="corner" type="number" step="0.01" style="margin-left:8px" />
        </label>
        <button id="save" style="padding:8px 12px">Save All Changes</button>
        <span id="status" style="margin-left:10px"></span>
      </div>

      <h3>Glass Items</h3>
      <button id="addGlass" style="margin-bottom:8px;padding:6px 10px">Add Glass Row</button>
      <div style="overflow:auto;border:1px solid #ddd">
        <table id="glassTable" style="border-collapse:collapse;width:100%">
          <thead>
            <tr>
              <th>SKU</th><th>W</th><th>H</th><th>Price</th><th>Labor</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <h3 style="margin-top:24px">Screen Presets</h3>
      <button id="addScreen" style="margin-bottom:8px;padding:6px 10px">Add Preset Row</button>
      <div style="overflow:auto;border:1px solid #ddd">
        <table id="screenTable" style="border-collapse:collapse;width:100%">
          <thead>
            <tr>
              <th>W</th><th>H</th><th>Labor</th>
              <th>Silver Fiber</th><th>Black Fiber</th><th>Silver Aluminum</th><th>Black Aluminum</th><th>Pet Screen</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <p style="color:#666;margin-top:16px">Tip: Save triggers a live update immediately (no redeploy needed).</p>
    </div>
  `);

  app.appendChild(node);

  // fill settings
  node.querySelector("#tax").value = pricing.taxRate;
  node.querySelector("#corner").value = pricing.cornerPrice;

  // render glass rows
  const glassBody = node.querySelector("#glassTable tbody");
  function addGlassRow(row = { sku:"", w:0, h:0, price:0, labor:0 }) {
    const tr = el(`
      <tr>
        <td><input data-k="sku" style="width:120px" /></td>
        <td><input data-k="w" type="number" style="width:70px" /></td>
        <td><input data-k="h" type="number" style="width:70px" /></td>
        <td><input data-k="price" type="number" step="0.01" style="width:90px" /></td>
        <td><input data-k="labor" type="number" step="0.01" style="width:90px" /></td>
        <td><button data-del style="padding:4px 8px">X</button></td>
      </tr>
    `);
    tr.querySelector('[data-k="sku"]').value = row.sku;
    tr.querySelector('[data-k="w"]').value = row.w;
    tr.querySelector('[data-k="h"]').value = row.h;
    tr.querySelector('[data-k="price"]').value = row.price;
    tr.querySelector('[data-k="labor"]').value = row.labor;
    tr.querySelector('[data-del]').onclick = () => tr.remove();
    glassBody.appendChild(tr);
  }
  pricing.glassPresets.forEach(addGlassRow);
  node.querySelector("#addGlass").onclick = () => addGlassRow();

  // render screen rows
  const screenBody = node.querySelector("#screenTable tbody");
  const mats = ["Silver Fiber","Black Fiber","Silver Aluminum","Black Aluminum","Pet Screen"];

  function addScreenRow(p = null) {
    const base = p || { w:0, h:0, laborDefault:0, materials: {} };
    const mp = (m) => numberVal(base.materials?.[m]?.price, 0);

    const tr = el(`
      <tr>
        <td><input data-k="w" type="number" style="width:70px" /></td>
        <td><input data-k="h" type="number" style="width:70px" /></td>
        <td><input data-k="laborDefault" type="number" step="0.01" style="width:90px" /></td>
        ${mats.map(m => `<td><input data-m="${m}" type="number" step="0.01" style="width:110px" /></td>`).join("")}
        <td><button data-del style="padding:4px 8px">X</button></td>
      </tr>
    `);

    tr.querySelector('[data-k="w"]').value = base.w;
    tr.querySelector('[data-k="h"]').value = base.h;
    tr.querySelector('[data-k="laborDefault"]').value = base.laborDefault;
    mats.forEach(m => tr.querySelector(`[data-m="${m}"]`).value = mp(m));
    tr.querySelector('[data-del]').onclick = () => tr.remove();
    screenBody.appendChild(tr);
  }

  pricing.screenPresets.forEach(addScreenRow);
  node.querySelector("#addScreen").onclick = () => addScreenRow();

  // Save
  node.querySelector("#save").onclick = async () => {
    const status = node.querySelector("#status");
    status.textContent = "Saving...";

    try {
      const taxRate = numberVal(node.querySelector("#tax").value, 0);
      const cornerPrice = numberVal(node.querySelector("#corner").value, 0);

      const glassPresets = Array.from(glassBody.querySelectorAll("tr")).map(tr => ({
        sku: tr.querySelector('[data-k="sku"]').value.trim(),
        w: numberVal(tr.querySelector('[data-k="w"]').value, 0),
        h: numberVal(tr.querySelector('[data-k="h"]').value, 0),
        price: numberVal(tr.querySelector('[data-k="price"]').value, 0),
        labor: numberVal(tr.querySelector('[data-k="labor"]').value, 0),
      })).filter(r => r.sku);

      const screenPresets = Array.from(screenBody.querySelectorAll("tr")).map(tr => {
        const w = numberVal(tr.querySelector('[data-k="w"]').value, 0);
        const h = numberVal(tr.querySelector('[data-k="h"]').value, 0);
        const laborDefault = numberVal(tr.querySelector('[data-k="laborDefault"]').value, 0);
        const materials = {};
        mats.forEach(m => materials[m] = { price: numberVal(tr.querySelector(`[data-m="${m}"]`).value, 0) });
        return { w, h, laborDefault, materials };
      }).filter(r => r.w > 0 && r.h > 0);

      await api("/.netlify/functions/pricing_save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ taxRate, cornerPrice, glassPresets, screenPresets })
      });

      status.textContent = "Saved (live now)";
    } catch (e) {
      console.error(e);
      node.querySelector("#status").textContent = "Save failed (check console)";
    }
  };
}

renderLogin();
