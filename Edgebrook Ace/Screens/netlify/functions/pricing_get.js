const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [glass, screens, tax, corner] = await Promise.all([
    supabase.from("glass_items").select("sku,w,h,price,labor").order("w").order("h"),
    supabase.from("screen_presets").select("w,h,labor_default,prices").order("w").order("h"),
    supabase.from("settings").select("value").eq("key", "taxRate").single(),
    supabase.from("settings").select("value").eq("key", "cornerPrice").single()
  ]);

  if (glass.error || screens.error || tax.error || corner.error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "DB error", details: { glass: glass.error, screens: screens.error, tax: tax.error, corner: corner.error } })
    };
  }

  const out = {
    taxRate: Number(tax.data.value),
    cornerPrice: Number(corner.data.value),
    glassPresets: glass.data.map(x => ({
      sku: x.sku, w: x.w, h: x.h, price: Number(x.price), labor: Number(x.labor)
    })),
    screenPresets: screens.data.map(s => ({
      w: s.w, h: s.h, laborDefault: Number(s.labor_default),
      materials: Object.fromEntries(
        Object.entries(s.prices || {}).map(([k,v]) => [k, { price: Number(v) }])
      )
    }))
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(out)
  };
};
