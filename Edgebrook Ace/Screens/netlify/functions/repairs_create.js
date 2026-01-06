const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
     if (event.httpMethod !== "POST")
        return {
            statusCode: 405,
            body: "Method not allowed"
        };

    const body = JSON.parse(event.body || "{}");

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    //Insert repair header
    const { data: repair, error: rErr } = await supabase 
        .from("repairs")
        .insert([body.repair])
        .select("id")
        .single();

    if (rErr) 
        return {
            statusCode: 500,
            body: JSON.stringify({ rErr })
        };

    // Insert items
    const items = (body.items || []).map(it => ({ ...it, repair_id: repair.id }));
    const { error: iErr } = await supabase.from("repair_items").insert(items);

    if (iErr) 
        return {
            statusCode: 500,
            body: JSON.stringify({ iErr })
        };
    
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, repairId: repair.id })
    };
};