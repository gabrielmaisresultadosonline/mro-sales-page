import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[KIWIFY-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const payload = await req.json();
    logStep("Payload received", payload);

    // Kiwify sends different event types
    const eventType = payload.order_status || payload.webhook_event_type;
    const customerEmail = payload.Customer?.email?.toLowerCase();
    const customerName = payload.Customer?.full_name || payload.Customer?.first_name;
    
    logStep("Event details", { eventType, customerEmail, customerName });

    // Only process approved purchases
    if (eventType !== 'paid' && eventType !== 'approved' && eventType !== 'completed') {
      logStep("Skipping non-purchase event", { eventType });
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!customerEmail) {
      logStep("Missing customer email");
      return new Response(JSON.stringify({ error: "Missing customer email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabaseClient
      .from('paid_users')
      .select('*')
      .eq('email', customerEmail)
      .maybeSingle();

    if (checkError) {
      logStep("Error checking user", { error: checkError.message });
      throw new Error("Database error: " + checkError.message);
    }

    // Calculate subscription end (30 days from now)
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

    if (existingUser) {
      // Update existing user subscription
      logStep("Updating existing user", { userId: existingUser.id });
      
      const { error: updateError } = await supabaseClient
        .from('paid_users')
        .update({
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString()
        })
        .eq('id', existingUser.id);

      if (updateError) {
        logStep("Error updating user", { error: updateError.message });
        throw new Error("Error updating user: " + updateError.message);
      }

      logStep("User subscription activated", { userId: existingUser.id, subscriptionEnd });
    } else {
      // Create new user with active subscription
      logStep("Creating new user from Kiwify webhook");
      
      const { data: newUser, error: insertError } = await supabaseClient
        .from('paid_users')
        .insert({
          email: customerEmail,
          username: customerName || customerEmail.split('@')[0],
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString()
        })
        .select()
        .single();

      if (insertError) {
        logStep("Error creating user", { error: insertError.message });
        throw new Error("Error creating user: " + insertError.message);
      }

      logStep("New user created with active subscription", { userId: newUser.id, subscriptionEnd });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Subscription activated" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
