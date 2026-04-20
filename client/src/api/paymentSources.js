import api from "./axios";

export function getSources() {
  return api.get("/payment-sources");
}

export function addSource(data) {
  return api.post("/payment-sources", data);
}

export function deleteSource(id) {
  return api.delete(`/payment-sources/${id}`);
}
