import AfricasTalking from "africastalking";

const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;

if (!username || !apiKey) {
  console.warn("⚠️ Africa's Talking credentials missing in env");
}

const AT = AfricasTalking({ username, apiKey });
const sms = AT.SMS;

export const sendSms = async ({ to, message }) => {
  // Africa's Talking expects `to` as an array of recipients
  const res = await sms.send({
    to: [to],
    message,
    // from: process.env.AT_SMS_FROM || undefined, // optional if you have sender ID/shortcode
  });

  return res;
};
