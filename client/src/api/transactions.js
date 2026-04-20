import api from "./axios";

export function getCategories() {
  return api.get("/transactions/categories");
}

export function getSubCategories(categoryId) {
  return api.get(`/transactions/categories/${categoryId}/subcategories`);
}

export function addTransaction(data) {
  return api.post("/transactions", data);
}

export function getTransactions() {
  return api.get("/transactions");
}

export function updateTransaction(id, data) {
  return api.put(`/transactions/${id}`, data);
}

export function deleteTransaction(id) {
  return api.delete(`/transactions/${id}`);
}

export function getPendingTransactions() {
  return api.get("/transactions/pending");
}

export function approveTransaction(id, edits) {
  return api.patch(`/transactions/${id}/approve`,edits);
}

export function rejectTransaction(id) {
  return api.patch(`/transactions/${id}/reject`);
}