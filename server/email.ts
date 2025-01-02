import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is required for sending emails");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendConfirmationEmail(to: string, username: string) {
  const msg = {
    to,
    from: "noreply@chatbot.com", // Remplacez par votre domaine vérifié SendGrid
    subject: "Bienvenue sur ChatBot - Confirmez votre email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Bienvenue sur ChatBot, ${username}!</h1>
        <p>Merci de vous être inscrit sur notre plateforme.</p>
        <p>Votre compte a été créé avec succès.</p>
        <p>Vous pouvez maintenant vous connecter et commencer à utiliser ChatBot.</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
  } catch (error: any) {
    console.error("Erreur lors de l'envoi de l'email:", error.message);
    throw new Error("Échec de l'envoi de l'email de confirmation");
  }
}
