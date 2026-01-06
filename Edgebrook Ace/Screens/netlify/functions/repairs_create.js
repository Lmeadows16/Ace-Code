// netlify/functions/repairs_create.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const body = JSON.parse(event.body || "{}");
        const repair = body.repair || {};
        const items = Array.isArray(body.items) ? body.items : [];

        // Accept either name
        const totalRepairs =
            repair.total_repairs ?? repair.total_screens ?? 0;

        // Accept either name for "repair total"
        const repairTotal =
            repair.repair_total ?? repair.screen_total ?? 0;

        // Build DB row (match your DB column names here)
        const repairRow = {
            employee_id: repair.employee_id || null,
            employee_name: repair.employee_name || null,
            repair_date: repair.repair_date || null,
            customer_name: repair.customer_name || null,
            phone: repair.phone || null,
            notes: repair.notes || "",
            total_repairs: totalRepairs,      // <- if your DB is total_repairs
            repair_total: repairTotal,        // <- if your DB is repair_total
            labor_total: repair.labor_total || 0,
            tax_total: repair.tax_total || 0,
            grand_total: repair.grand_total || 0
        };

        const { data: insertedRepair, error: rErr } = await supabase
            .from("repairs")
            .insert(repairRow)
            .select("id")
            .single();

        if (rErr) {
            return { statusCode: 500, body: JSON.stringify({ error: "repairs insert failed", details: rErr }) };
        }

        const repairId = insertedRepair.id;

        const itemRows = items.map(it => ({
            repair_id: repairId,
            width: it.width ?? 0,
            height: it.height ?? 0,
            quantity: it.quantity ?? 0,
            material: it.material ?? "",
            sku: it.sku ?? null,
            unit_price: it.unit_price ?? 0,
            unit_labor: it.unit_labor ?? 0,
            corner_qty: it.corner_qty ?? 0,
            corner_cost: it.corner_cost ?? 0,
            line_total: it.line_total ?? 0
        }));

        if (itemRows.length > 0) {
            const { error: iErr } = await supabase
                .from("repair_items")
                .insert(itemRows);

            if (iErr) {
                return { statusCode: 500, body: JSON.stringify({ error: "repair_items insert failed", details: iErr }) };
            }
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ok: true, id: repairId })
        };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
    }
};
