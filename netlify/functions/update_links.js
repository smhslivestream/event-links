// netlify/functions/update_links.js
import fetch from "node-fetch";

// Fonction pour convertir "2025-11-02" → "Sunday, Nov. 2"
function formatDateLabel(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return "Invalid date";
  
  const options = { weekday: "long", month: "short", day: "numeric" };
  const formatted = date.toLocaleDateString("en-US", options);

  // Ajouter suffixe "st", "nd", "rd", "th"
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";

  const parts = formatted.split(" ");
  return `${parts[0]}, ${parts[1]} ${day}${suffix}`;
}

export async function handler(event) {
  try {
    // Les données envoyées par le formulaire HTML
    const data = JSON.parse(event.body);

    // Ton token GitHub (variable d'environnement)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // Ton dépôt GitHub et fichier à modifier
    const REPO = "meganus2000/event-links";
    const FILE_PATH = "liens.json";

    // Étape 1 — Lire le fichier existant depuis GitHub
    const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!getRes.ok) {
      throw new Error(`GitHub GET failed: ${getRes.status}`);
    }

    const file = await getRes.json();
    const content = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));

    // Étape 2 — Archiver l'ancien événement
    if (content.current_event) {
      content.past_events.unshift({
        archived_at: new Date().toISOString(),
        ...content.current_event
      });
    }

    // Étape 3 — Ajouter le nouvel événement avec les dates formatées
    data.days.forEach(day => {
      if (!day.label && day.date) {
        day.label = formatDateLabel(day.date);
      }
    });
    content.current_event = data;

    // Étape 4 — Encoder le nouveau JSON en base64
    const updatedContent = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");

    // Étape 5 — Envoyer la mise à jour à GitHub
    const updateRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "🔄 Update from SMHS admin panel",
        content: updatedContent,
        sha: file.sha
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`GitHub PUT failed: ${errText}`);
    }

    return { statusCode: 200, body: "✅ Success! liens.json updated on GitHub." };

  } catch (err) {
    console.error("❌ Error:", err);
    return { statusCode: 500, body: `❌ Error: ${err.message}` };
  }
}
