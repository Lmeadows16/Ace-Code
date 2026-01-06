const { createClient } = require("@supabase/supabase-js")

exports.handler = async (event) => {
    try {
        if (event.httpMethod !== "GET") {
            return {
                statusCode: 405, 
                body: "Method not allowed"
            };
        }

        const id = (event.queryStringParameters?.id || "").trim();
        if (!id) {
            return {
                statusCode: 400, 
                body: JSON.stringify({ error: "Missing id"})
            };
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
            .from("employees")
            .select("name")
            .eq("employee_id", id)
            .single();

        if (error) {
            // Not found or DB error
            return {
                statusCode: 404, 
                body: JSON.stringify({ error: "Not found"})
            };
        }

        return {
            statusCode: 200,
            headers: { "Conmtent-Type": "applications/json", "Cache-Control": "no-store" },
            body: JSON.stringify({ employeeId: id, employeeName: data.name })
        };
    } catch (e) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: String(e) })
        };
    }
};