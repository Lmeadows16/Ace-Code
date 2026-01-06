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

// async function api(path, opts = {}) {
//   const res = await fetch(path, opts);
//   const text = await res.text();
//   if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
//   return text ? JSON.parse(text) : {};
// }

async function api(path, opts = {}) {
  if (typeof path !== "string") {
    console.error("api() called with NON-string path:", path);
    throw new Error("api() path must be a string (see console for caller).");
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : {};
}


function money(n) {
  return `$${numberVal(n, 0).toFixed(2)}`;
}

function apiAuth(path, opts = {}) {
  return api(path, {
    ...opts,
    headers: {
      ...api(opts.headers || {}),
      "Authorization": `Bearer ${token}`
    }
  });
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

let employees = [];

async function loadPricingAndRender() {
  pricing = await api("/.netlify/functions/pricing_get", { cache: "no-store" });

  //Employees endpoint
  const emp = await api("/.netlify/functions/employees_get", { cache: "no-store" });
  employees = emp.employees || [];

  renderEditor();
}

function renderEditor() {
  app.innerHTML = "";

  const node = el(`
    <div style="max-width:1200px;margin:24px auto;font-family:Arial">
      <h2>Admin</h2>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 18px 0">
        <button data-tab="pricing" style="padding:8px 12px">Pricing</button>
        <button data-tab="employees" style="padding:8px 12px">Employees</button>
        <button data-tab="history" style="padding:8px 12px">History</button>
        <span id="globalStatus" style="margin-left:10px;color:#666"></span>
      </div>

      <div id="tabContent"></div>
    </div>
  `);

  app.appendChild(node);

  const tabContent = node.querySelector("#tabContent");
  const status = node.querySelector("#globalStatus");

  function setStatus(msg) {
    status.textContent = msg || "";
  }

  async function refreshEmployees() {
    const emp = await api("/.netlify/functions/employees_get", { cache: "no-store" });
    employees = emp.employees || [];
  }

  function renderPricingTab() {
    tabContent.innerHTML = "";

    const pricingNode = el(`
      <div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
          <label>Tax rate
            <input id="tax" type="number" step="0.0001" style="margin-left:8px" />
          </label>
          <label>Corner price
            <input id="corner" type="number" step="0.01" style="margin-left:8px" />
          </label>
          <button id="savePricing" style="padding:8px 12px">Save Pricing</button>
          <span id="pricingStatus" style="margin-left:10px"></span>
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

        <p style="color:#666;margin-top:16px">Pricing saves are live immediately (no redeploy).</p>
      </div>
    `);

    tabContent.appendChild(pricingNode);

    // fill settings
    pricingNode.querySelector("#tax").value = pricing.taxRate;
    pricingNode.querySelector("#corner").value = pricing.cornerPrice;

    const glassBody = pricingNode.querySelector("#glassTable tbody");
    function addGlassRow(row = { sku: "", w: 0, h: 0, price: 0, labor: 0 }) {
      const tr = el(`<tr>
        <td><input data-k="sku" style="width:120px" /></td>
        <td><input data-k="w" type="number" style="width:70px" /></td>
        <td><input data-k="h" type="number" style="width:70px" /></td>
        <td><input data-k="price" type="number" step="0.01" style="width:90px" /></td>
        <td><input data-k="labor" type="number" step="0.01" style="width:90px" /></td>
        <td><button data-del style="padding:4px 8px">X</button></td>
      </tr>`);

      tr.querySelector('[data-k="sku"]').value = row.sku ?? "";
      tr.querySelector('[data-k="w"]').value = row.w ?? 0;
      tr.querySelector('[data-k="h"]').value = row.h ?? 0;
      tr.querySelector('[data-k="price"]').value = row.price ?? 0;
      tr.querySelector('[data-k="labor"]').value = row.labor ?? 0;
      tr.querySelector('[data-del]').onclick = () => tr.remove();
      glassBody.appendChild(tr);
    }
    (pricing.glassPresets || []).forEach(addGlassRow);
    pricingNode.querySelector("#addGlass").onclick = () => addGlassRow();

    const screenBody = pricingNode.querySelector("#screenTable tbody");
    const mats = ["Silver Fiber", "Black Fiber", "Silver Aluminum", "Black Aluminum", "Pet Screen"];

    function addScreenRow(p = null) {
      const base = p || { w: 0, h: 0, laborDefault: 0, materials: {} };
      const mp = (m) => numberVal(base.materials?.[m]?.price, 0);

      const tr = el(`<tr>
        <td><input data-k="w" type="number" style="width:70px" /></td>
        <td><input data-k="h" type="number" style="width:70px" /></td>
        <td><input data-k="laborDefault" type="number" step="0.01" style="width:90px" /></td>
        ${mats.map(m => `<td><input data-m="${m}" type="number" step="0.01" style="width:110px" /></td>`).join("")}
        <td><button data-del style="padding:4px 8px">X</button></td>
      </tr>`);

      tr.querySelector('[data-k="w"]').value = base.w ?? 0;
      tr.querySelector('[data-k="h"]').value = base.h ?? 0;
      tr.querySelector('[data-k="laborDefault"]').value = base.laborDefault ?? 0;
      mats.forEach(m => tr.querySelector(`[data-m="${m}"]`).value = mp(m));
      tr.querySelector('[data-del]').onclick = () => tr.remove();
      screenBody.appendChild(tr);
    }

    (pricing.screenPresets || []).forEach(addScreenRow);
    pricingNode.querySelector("#addScreen").onclick = () => addScreenRow();

    pricingNode.querySelector("#savePricing").onclick = async () => {
      const pricingStatus = pricingNode.querySelector("#pricingStatus");
      pricingStatus.textContent = "Saving...";

      try {
        const taxRate = numberVal(pricingNode.querySelector("#tax").value, 0);
        const cornerPrice = numberVal(pricingNode.querySelector("#corner").value, 0);

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

        // refresh cached pricing
        pricing = await api("/.netlify/functions/pricing_get", { cache: "no-store" });

        pricingStatus.textContent = "Saved (live now)";
      } catch (e) {
        console.error(e);
        pricingStatus.textContent = "Save failed (check console)";
      }
    };
  }

  function renderEmployeesTab() {
    tabContent.innerHTML = "";

    const empNode = el(`
      <div>
        <h3>Employees</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0">
          <button id="addEmp" style="padding:8px 12px">Add Employee</button>
          <button id="saveEmp" style="padding:8px 12px">Save Employees</button>
          <span id="empStatus" style="margin-left:10px"></span>
        </div>

        <div style="overflow:auto;border:1px solid #ddd">
          <table style="border-collapse:collapse;width:100%">
            <thead>
              <tr>
                <th>Employee ID</th><th>Name</th><th>Active</th><th></th>
              </tr>
            </thead>
            <tbody id="empBody"></tbody>
          </table>
        </div>
      </div>
    `);

    tabContent.appendChild(empNode);

    const empBody = empNode.querySelector("#empBody");
    const empStatus = empNode.querySelector("#empStatus");

    function addEmpRow(row = { employee_id: "", name: "", active: true }) {
      const tr = el(`<tr>
        <td><input data-k="id" style="width:140px" /></td>
        <td><input data-k="name" style="width:260px" /></td>
        <td style="text-align:center"><input data-k="active" type="checkbox" /></td>
        <td><button data-del style="padding:4px 8px">X</button></td>
      </tr>`);

      tr.querySelector('[data-k="id"]').value = row.employee_id ?? "";
      tr.querySelector('[data-k="name"]').value = row.name ?? "";
      tr.querySelector('[data-k="active"]').checked = !!row.active;
      tr.querySelector('[data-del]').onclick = () => tr.remove();
      empBody.appendChild(tr);
    }

    (employees || []).forEach(addEmpRow);
    empNode.querySelector("#addEmp").onclick = () => addEmpRow();

    empNode.querySelector("#saveEmp").onclick = async () => {
      empStatus.textContent = "Saving...";
      try {
        const payload = Array.from(empBody.querySelectorAll("tr")).map(tr => ({
          employee_id: tr.querySelector('[data-k="id"]').value.trim(),
          name: tr.querySelector('[data-k="name"]').value.trim(),
          active: tr.querySelector('[data-k="active"]').checked
        })).filter(e => e.employee_id && e.name);

        await api("/.netlify/functions/employees_save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ employees: payload })
        });

        await refreshEmployees();
        empStatus.textContent = "Saved";
      } catch (e) {
        console.error(e);
        empStatus.textContent = "Save failed (check console)";
      }
    };
  }

  function renderHistoryTab() {
    tabContent.innerHTML = "";

    const histNode = el(`
      <div>
        <h3>Repair History</h3>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0">
          <label>Show
            <select id="limit" style="margin-left:6px">
              <option value="25">25</option>
              <option value="50" selected>50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
          <button id="refresh" style="padding:8px 12px">Refresh</button>
          <span id="histStatus" style="margin-left:10px"></span>
        </div>

        <div style="overflow:auto;border:1px solid #ddd">
          <table style="border-collapse:collapse;width:100%">
            <thead>
              <tr>
                <th>Created</th>
                <th>Employee</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total Repairs</th>
                <th>Grand Total</th>
              </tr>
            </thead>
            <tbody id="histBody"></tbody>
          </table>
        </div>
      </div>
    `);

    tabContent.appendChild(histNode);

    const histBody = histNode.querySelector("#histBody");
    const histStatus = histNode.querySelector("#histStatus");
    const limitSel = histNode.querySelector("#limit");

    function showRepairDetailModal(repair, items) {
      const modal = el(`
    <div style="
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center; padding:16px; z-index:9999;">
      <div style="background:#fff; max-width:1100px; width:100%; max-height:90vh; overflow:auto; border-radius:8px; padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h3 style="margin:0">Repair Details</h3>
          <button id="close" style="padding:8px 12px">Close</button>
        </div>

        <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div><b>Created:</b> ${new Date(repair.created_at).toLocaleString()}</div>
          <div><b>Repair Date:</b> ${repair.repair_date}</div>
          <div><b>Employee:</b> ${repair.employee_name} (${repair.employee_id})</div>
          <div><b>Customer:</b> ${repair.customer_name}</div>
          <div><b>Phone:</b> ${repair.phone}</div>
          <div><b>Total Repairs:</b> ${repair.total_repairs}</div>
          <div style="grid-column:1/-1"><b>Notes:</b> ${repair.notes || ""}</div>
          <div><b>Repair Total:</b> ${money(repair.repair_total)}</div>
          <div><b>Labor:</b> ${money(repair.labor_total)}</div>
          <div><b>Tax:</b> ${money(repair.tax_total)}</div>
          <div><b>Grand Total:</b> ${money(repair.grand_total)}</div>
        </div>

        <h4 style="margin-top:16px">Line Items</h4>
        <div style="overflow:auto;border:1px solid #ddd">
          <table style="border-collapse:collapse;width:100%">
            <thead>
              <tr>
                <th>#</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Material</th>
                <th>SKU</th>
                <th>Unit Price</th>
                <th>Unit Labor</th>
                <th>Corners</th>
                <th>Corner Cost</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${it.width}" × ${it.height}"</td>
                  <td style="text-align:center">${it.quantity}</td>
                  <td>${it.material}</td>
                  <td>${it.sku || ""}</td>
                  <td>${money(it.unit_price)}</td>
                  <td>${money(it.unit_labor)}</td>
                  <td style="text-align:center">${it.corner_qty}</td>
                  <td>${money(it.corner_cost)}</td>
                  <td>${money(it.line_total)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);

      modal.querySelector("#close").onclick = () => modal.remove();
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

      document.body.appendChild(modal);
    }


    async function loadHistory() {
      histStatus.textContent = "Loading...";
      histBody.innerHTML = "";

      try {
        const limit = limitSel.value;
        const data = await apiAuth(`/.netlify/functions/repairs_list?limit=${encodeURIComponent(limit)}`, {
          cache: "no-store"
        });

        const repairs = data.repairs || [];
        if (repairs.length === 0) {
          histStatus.textContent = "No repairs found.";
          return;
        }

        repairs.forEach(r => {
          const tr = el(`<tr style="cursor:pointer">
          <td style="white-space:nowrap">${new Date(r.created_at).toLocaleString()}</td>
          <td>${r.employee_name} (${r.employee_id})</td>
          <td>${r.customer_name}</td>
          <td style="white-space:nowrap">${r.phone}</td>
          <td style="text-align:center">${total_repairs}</td>
          <td style="white-space:nowrap">${money(r.grand_total)}</td>
          </tr>`);

          tr.onclick = async () => {
            try {
              histStatus.textContent = "Loading details...";
              const detail = await apiAuth(`/.netlify/functions/repairs_detail?id=${encodeURIComponent(r.id)}`, {
                cache: "no-store"
              });
              showRepairDetailModal(detail.repair, detail.items);
              histStatus.textContent = "";
            } catch (e) {
              console.error(e);
              histStatus.textContent = "Detail load failed (check console)";
            }
          };

          histBody.appendChild(tr);

        });

        histStatus.textContent = `Loaded ${repairs.length}`;
      } catch (e) {
        console.error(e);
        histStatus.textContent = "Load failed (check console)";
      }
    }

    histNode.querySelector("#refresh").onclick = loadHistory;
    loadHistory();
  }

  function setActive(tabName) {
    // simple active styling
    node.querySelectorAll("button[data-tab]").forEach(b => {
      b.style.background = (b.getAttribute("data-tab") === tabName) ? "#eee" : "";
      b.style.border = "1px solid #ccc";
    });

    setStatus("");
    if (tabName === "pricing") renderPricingTab();
    if (tabName === "employees") renderEmployeesTab();
    if (tabName === "history") renderHistoryTab();
  }

  // Wire tab buttons
  node.querySelectorAll("button[data-tab]").forEach(b => {
    b.onclick = () => setActive(b.getAttribute("data-tab"));
  });

  // default tab
  setActive("pricing");
}


renderLogin();
