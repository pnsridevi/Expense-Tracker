import api from "./axios";

export function triggerEmailFetch() {
  return api.post("/emails/fetch");
}
export function getFailedEmails() {
  return api.get("/emails/failed");
}
