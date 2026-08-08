// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.json();

    // Validation des données
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.email?.trim() || !formData.phone?.trim()) {
      return new Response(
        JSON.stringify({ 
          error: "Données manquantes",
          details: {
            firstName: !formData.firstName?.trim() ? "Le prénom est requis" : null,
            lastName: !formData.lastName?.trim() ? "Le nom est requis" : null,
            email: !formData.email?.trim() ? "L'email est requis" : null,
            phone: !formData.phone?.trim() ? "Le téléphone est requis" : null,
          }
        }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Validation de l'email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return new Response(
        JSON.stringify({ 
          error: "Email invalide",
          details: { email: "L'adresse email n'est pas valide" }
        }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Formatage du message
    const message = `
Nouvelle demande d'installation solaire

Informations personnelles :
- Nom : ${formData.lastName}
- Prénom : ${formData.firstName}
- Email : ${formData.email}
- Téléphone : ${formData.phone}

Informations du projet :
- Adresse : ${formData.address}
- Type de bâtiment : ${formData.buildingType === 'house' ? 'Maison' : 'Appartement'}
- Surface : ${formData.surface} m²
- Nombre d'habitants : ${formData.residents}
- Type de chauffage : ${formData.heatingType}
- Consommation : ${formData.billValue} ${formData.billUnit} ${formData.billType === 'monthly' ? 'par mois' : 'par an'}
- Type de toiture : ${formData.roofType}

Coordonnées GPS :
- Latitude : ${formData.coordinates?.lat}
- Longitude : ${formData.coordinates?.lng}

Recommandation :
- Puissance recommandée : ${formData.powerRecommendation} kWc
- Budget estimé : Entre ${formData.priceRange.min}€ et ${formData.priceRange.max}€
- Facture mensuelle actuelle : ${formData.monthlyBill}€

Message :
${formData.message || 'Aucun message'}
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("La clé API Resend n'est pas configurée");
    }

    // Envoi via l'API Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "contact@amy-energie.fr",
        to: "contact@amy-energie.fr",
        subject: `Nouvelle demande - ${formData.firstName} ${formData.lastName}`,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erreur Resend:", errorData);
      throw new Error("Erreur lors de l'envoi de l'email");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error("Erreur:", error);
    
    // Retourner une réponse d'erreur structurée
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
});