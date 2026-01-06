const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase 
        .from("employees")
        .select("employee_id,name")
        .order("employee_id");

    if (error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error })
        };

    return {
        statusCode: 200,
        headers: { "Content-Type": "applications/json", "Cache-Control": "no-store"},
        body: JSON.stringify({ employees: data })
    };
};